"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { exportReport } from "@/lib/actions/report-export";
import type { ReportFormat } from "@/lib/report-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Download } from "lucide-react";

export interface ReportFilterField {
  name: string;
  label: string;
  type: "date" | "text" | "number" | "select";
  value: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

// Filtros genéricos de relatório: monta a query string (?from=&to=&...)
// e navega — o servidor refaz o relatório com os novos parâmetros.
export function ReportFilters({ basePath, fields }: { basePath: string; fields: ReportFilterField[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.name, f.value])));

  function apply() {
    const qs = new URLSearchParams();
    Object.entries(values).forEach(([k, v]) => {
      if (v !== "") qs.set(k, v);
    });
    router.push(`${basePath}?${qs.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={`rf-${f.name}`}>{f.label}</Label>
          {f.type === "select" ? (
            <Select value={values[f.name]} onValueChange={(v) => v && setValues({ ...values, [f.name]: v })}>
              <SelectTrigger id={`rf-${f.name}`} className="min-w-40">
                <SelectValue>{(v: string) => f.options?.find((o) => o.value === v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {f.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`rf-${f.name}`}
              type={f.type}
              step={f.type === "number" ? "0.01" : undefined}
              placeholder={f.placeholder}
              value={values[f.name]}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              className={f.type === "number" ? "w-28" : undefined}
            />
          )}
        </div>
      ))}
      <Button onClick={apply}>Filtrar</Button>
    </div>
  );
}

function fmtMoney(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FORMATS: { value: ReportFormat; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "XLSX" },
  { value: "rtf", label: "RTF" },
  { value: "pdf", label: "PDF" },
];

// Tabela de relatório + botões de exportação (CSV, XLSX, RTF, PDF) do que
// está na tela. Células numéricas são formatadas em R$ pt-BR.
export function ReportView({
  title,
  subtitle,
  filenameBase,
  columns,
  rows,
  numericColumns = [],
  emptyMessage = "Nada no período selecionado.",
}: {
  title: string;
  subtitle?: string;
  filenameBase: string;
  columns: string[];
  rows: (string | number | null)[][];
  numericColumns?: number[];
  emptyMessage?: string;
}) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const num = new Set(numericColumns);

  async function handleExport(format: ReportFormat) {
    setBusy(format);
    const result = await exportReport(format, {
      title,
      subtitle,
      columns,
      rows: rows.map((r) => r.map((c) => (c === null ? "" : c))),
      numericColumns,
      filenameBase,
    });
    setBusy(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Exportar o que está na tela:</span>
        {FORMATS.map((f) => (
          <Button key={f.value} variant="outline" size="sm" disabled={busy !== null || rows.length === 0} onClick={() => handleExport(f.value)}>
            <Download size={14} /> {busy === f.value ? "Gerando..." : f.label}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead key={i} className={num.has(i) ? "text-right" : undefined}>
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, ri) => (
              <TableRow key={ri}>
                {r.map((c, i) => (
                  <TableCell key={i} className={num.has(i) ? "text-right tabular-nums" : undefined}>
                    {c === null || c === "" ? "" : typeof c === "number" ? fmtMoney(c) : c}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-6">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

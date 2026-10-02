"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { ExpenseListRow } from "@/lib/actions/expenses";
import { deleteExpense } from "@/lib/actions/expenses";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-method";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Download, FileText, Trash2, Pencil } from "lucide-react";

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ComprasHistoryTable({ rows, canManage = true }: { rows: ExpenseListRow[]; canManage?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const total = rows.reduce((sum, r) => sum + r.total_amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Total no período: R$ {total.toFixed(2)}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCsv("compras-despesas.csv", [
              ["Data", "Categoria", "Fornecedor", "Valor (R$)", "Forma de pagamento", "Lançado por"],
              ...rows.map((r) => [
                r.date,
                r.category_name,
                r.supplier_name ?? "—",
                r.total_amount.toFixed(2),
                r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] : "—",
                r.created_by_name ?? "—",
              ]),
            ])
          }
        >
          <Download size={14} /> Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Lançado por</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.date.split("-").reverse().join("/")}</TableCell>
                <TableCell>{r.category_name}</TableCell>
                <TableCell>{r.supplier_name ?? "—"}</TableCell>
                <TableCell>R$ {r.total_amount.toFixed(2)}</TableCell>
                <TableCell>{r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] : "—"}</TableCell>
                <TableCell>{r.created_by_name ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {r.receipt_url && (
                      <a href={r.receipt_url} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="icon-sm" title="Ver foto da nota">
                          <FileText size={14} />
                        </Button>
                      </a>
                    )}
                    {canManage && (
                      <>
                        <Link href={`/compras/historico/${r.id}/editar`}>
                          <Button variant="ghost" size="icon-sm" title="Editar despesa">
                            <Pencil size={14} />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                          onClick={() => {
                            if (!confirm("Excluir esta despesa?")) return;
                            startTransition(async () => {
                              const result = await deleteExpense(r.id);
                              if (result?.error) toast.error(result.error);
                              else router.refresh();
                            });
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhuma despesa no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

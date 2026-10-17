"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createManualLedgerEntry, reverseLedgerEntryAction } from "@/lib/actions/ledger";
import type { LedgerEntryRow } from "@/lib/actions/ledger";
import type { LedgerAccount, CostCenter } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatDatePt } from "@/lib/date";
import { Plus, Trash2, Undo2 } from "lucide-react";

interface LineRow {
  account_code: string;
  cost_center_id: string;
  direction: "debito" | "credito";
  amount: string;
}

function emptyLine(direction: "debito" | "credito"): LineRow {
  return { account_code: "", cost_center_id: "", direction, amount: "" };
}

export function LedgerEntriesPanel({
  entries,
  accounts,
  costCenters,
}: {
  entries: LedgerEntryRow[];
  accounts: LedgerAccount[];
  costCenters: CostCenter[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ManualEntryDialog accounts={accounts} costCenters={costCenters} />
      </div>
      <div className="space-y-2">
        {entries.map((e) => (
          <EntryCard key={e.id} entry={e} />
        ))}
        {entries.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum lançamento no período.</p>}
      </div>
    </div>
  );
}

function fmt(v: number): string {
  return `R$ ${v.toFixed(2)}`;
}

function EntryCard({ entry }: { entry: LedgerEntryRow }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleReverse() {
    const reason = prompt("Motivo do estorno (opcional):") ?? "";
    if (reason === null) return;
    startTransition(async () => {
      const result = await reverseLedgerEntryAction(entry.id, reason);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Lançamento estornado.");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {entry.description}
            {entry.status === "estornado" && <Badge variant="secondary" className="ml-2">Estornado</Badge>}
            {entry.origin === "estorno" && <Badge variant="secondary" className="ml-2">Estorno</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDatePt(entry.entry_date)} · origem: {entry.origin}
            {entry.created_by_name ? ` · ${entry.created_by_name}` : ""}
          </p>
        </div>
        {entry.status === "confirmado" && (
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleReverse}>
            <Undo2 size={14} /> Estornar
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {entry.lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between text-sm pl-3 border-l-2 border-border">
            <span>
              {l.direction === "debito" ? "Débito" : "Crédito"} — {l.account_name}
              {l.cost_center_name ? ` (${l.cost_center_name})` : ""}
            </span>
            <span className="font-medium">{fmt(l.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManualEntryDialog({ accounts, costCenters }: { accounts: LedgerAccount[]; costCenters: CostCenter[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [entryDate, setEntryDate] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine("debito"), emptyLine("credito")]);

  function updateLine(index: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine("debito")]);
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const totalDebito = lines.filter((l) => l.direction === "debito").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const totalCredito = lines.filter((l) => l.direction === "credito").reduce((s, l) => s + (Number(l.amount) || 0), 0);

  function accountRequiresCostCenter(code: string): boolean {
    return accounts.find((a) => a.code === code)?.requires_cost_center ?? false;
  }

  function handleSave() {
    if (!description.trim()) {
      toast.error("Informe uma descrição.");
      return;
    }
    if (lines.some((l) => !l.account_code || !l.amount || Number(l.amount) <= 0)) {
      toast.error("Preencha a conta e o valor de cada linha.");
      return;
    }
    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      toast.error(`Débitos (${fmt(totalDebito)}) e créditos (${fmt(totalCredito)}) precisam ser iguais.`);
      return;
    }
    startTransition(async () => {
      const result = await createManualLedgerEntry(
        entryDate,
        description,
        lines.map((l) => ({
          account_code: l.account_code,
          cost_center_id: l.cost_center_id || null,
          direction: l.direction,
          amount: Number(l.amount),
        }))
      );
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Lançamento criado.");
        setOpen(false);
        setDescription("");
        setLines([emptyLine("debito"), emptyLine("credito")]);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus size={14} /> Novo lançamento manual
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lançamento manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Linhas (débitos {fmt(totalDebito)} / créditos {fmt(totalCredito)})
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                <Plus size={12} /> Linha
              </Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center rounded-lg bg-muted/40 p-2">
                <Select value={line.direction} onValueChange={(v) => v && updateLine(index, { direction: v as "debito" | "credito" })}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Direção">{(v: string) => (v === "debito" ? "Débito" : "Crédito")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debito">Débito</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={line.account_code} onValueChange={(v) => v && updateLine(index, { account_code: v, cost_center_id: "" })}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Conta">{(v: string) => accounts.find((a) => a.code === v)?.name ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accountRequiresCostCenter(line.account_code) ? (
                  <Select value={line.cost_center_id} onValueChange={(v) => v && updateLine(index, { cost_center_id: v })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Centro de custo">
                        {(v: string) => costCenters.find((c) => c.id === v)?.name ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div />
                )}
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-28"
                  placeholder="Valor"
                  value={line.amount}
                  onChange={(e) => updateLine(index, { amount: e.target.value })}
                />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLine(index)} disabled={lines.length <= 2}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

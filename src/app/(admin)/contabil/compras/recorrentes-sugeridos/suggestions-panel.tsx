"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerRecurringSuggestions, type RecurringSuggestion } from "@/lib/actions/recurring-suggestions";
import type { ExpenseCategory } from "@/lib/expense-model-types";

interface Row extends RecurringSuggestion {
  checked: boolean;
  amountText: string;
  dayText: string;
  category: string;
}

export function SuggestionsPanel({ suggestions, categories }: { suggestions: RecurringSuggestion[]; categories: ExpenseCategory[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>(
    suggestions.map((s) => ({ ...s, checked: true, amountText: String(s.amount), dayText: String(s.dayOfMonth), category: s.categoryId ?? "" }))
  );

  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  }

  function save() {
    const chosen = rows.filter((r) => r.checked);
    startTransition(async () => {
      const res = await registerRecurringSuggestions(
        chosen.map((r) => ({
          name: r.name,
          categoryId: r.category,
          amount: Number(r.amountText.replace(",", ".")),
          dayOfMonth: Number(r.dayText),
          lastDate: r.lastDate,
        }))
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${res.created} item(ns) recorrente(s) cadastrado(s)${res.skipped ? ` · ${res.skipped} já existia(m)` : ""}.`);
        router.push("/contabil/listas/itens-recorrentes");
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          A IA não encontrou nenhuma despesa que pareça recorrente (ou todas já estão cadastradas). Você pode cadastrar à mão em
          Listas contábeis → Itens recorrentes.
        </p>
        <Link href="/contabil/compras/caixa">
          <Button variant="outline" size="sm">Ir para a caixa de conferência</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {rows.map((r, i) => (
        <div key={r.key} className={`space-y-2 rounded-lg border p-3 ${r.checked ? "border-border bg-card" : "border-border opacity-60"}`}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={r.checked} onChange={(e) => patch(i, { checked: e.target.checked })} />
            <Input className="h-8" value={r.name} onChange={(e) => patch(i, { name: e.target.value })} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="h-9 col-span-3 sm:col-span-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={r.category}
              onChange={(e) => patch(i, { category: e.target.value })}
            >
              <option value="">Categoria…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input inputMode="decimal" value={r.amountText} onChange={(e) => patch(i, { amountText: e.target.value })} aria-label="Valor mensal" />
            <Input type="number" min={1} max={28} value={r.dayText} onChange={(e) => patch(i, { dayText: e.target.value })} aria-label="Dia do mês" />
          </div>
          <p className="text-xs text-muted-foreground">
            Visto em {r.months} mês(es) · última nota em {r.lastDate.split("-").reverse().join("/")} · valor mensal (R$) e dia do mês à direita.
          </p>
        </div>
      ))}
      <Button onClick={save} disabled={isPending}>
        {isPending ? "Cadastrando..." : "Cadastrar os itens marcados"}
      </Button>
    </div>
  );
}

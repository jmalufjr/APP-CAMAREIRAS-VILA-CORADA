"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmInboxBatch } from "@/lib/actions/purchase-inbox";

export interface BatchItem {
  id: string;
  title: string; // "dd/mm/aaaa · Fornecedor"
  total: number | null;
  lines: { description: string; amount: number; category: string }[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Notas de Alimentos sem ingrediente reconhecido: a IA já escolheu a categoria, e o custo vai
// 100% para o Café da manhã. Você confere a lista e confirma várias de uma vez.
export function BatchConfirm({ items }: { items: BatchItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = items.length > 0 && selected.size === items.length;
  const selectedTotal = items.filter((i) => selected.has(i.id)).reduce((s, i) => s + (i.total ?? 0), 0);

  function confirmBatch() {
    if (selected.size === 0) return;
    if (!confirm(`Lançar ${selected.size} nota(s), no total de ${brl(selectedTotal)}, como despesa do Café da manhã (100%), sem ingrediente do bar?`)) return;
    startTransition(async () => {
      const r = await confirmInboxBatch(Array.from(selected));
      if (r.saved > 0) toast.success(`${r.saved} nota(s) lançada(s).`);
      if (r.failed.length > 0) toast.error(`${r.failed.length} não foram lançadas: ${r.failed[0].error}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  if (items.length === 0) return null;
  return (
    <section className="space-y-3 max-w-3xl rounded-lg border border-border bg-card p-3">
      <div>
        <h3 className="font-heading text-lg">Confirmar em lote — Alimentos sem ingrediente do bar</h3>
        <p className="text-xs text-muted-foreground mt-1">
          A IA classificou estas notas em Alimentos e não encontrou nenhum ingrediente do bar nelas. Se for assim mesmo, o custo vai <strong>100% para o Café da manhã</strong> e
          não entra na rentabilidade de petiscos e drinks. Se algum item for insumo do bar, abra a nota e escolha o ingrediente.
        </p>
      </div>
      <div className="space-y-1.5">
        {items.map((it) => (
          <label key={it.id} className="flex items-start gap-2 rounded-md border border-border/60 p-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{it.title}</span>
                <span className="font-medium">{it.total ? brl(it.total) : "—"}</span>
              </div>
              <ul className="mt-0.5 text-xs text-muted-foreground space-y-0.5">
                {it.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {l.description} — {l.category}
                    </span>
                    <span className="shrink-0">{brl(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/contabil/compras/caixa/${it.id}`} className="text-xs text-primary underline" onClick={(e) => e.stopPropagation()}>
                Abrir para conferir ou editar
              </Link>
            </div>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}>
          {allSelected ? "Limpar seleção" : "Selecionar todas"}
        </Button>
        <Button size="sm" disabled={isPending || selected.size === 0} onClick={confirmBatch}>
          {isPending ? "Lançando..." : `Confirmar selecionadas (${selected.size}) — ${brl(selectedTotal)}`}
        </Button>
      </div>
    </section>
  );
}

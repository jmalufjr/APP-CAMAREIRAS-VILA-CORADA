"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decidePendingPurchase } from "@/lib/actions/purchases-new";
import type { PurchaseRecord } from "@/lib/expense-model-types";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dmy = (d: string) => d.split("-").reverse().join("/");

export function PurchasesTable({ purchases, isAdmin }: { purchases: PurchaseRecord[]; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function decide(id: string, d: "aprovar" | "cancelar") {
    startTransition(async () => {
      const r = await decidePendingPurchase(id, d);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(d === "aprovar" ? "Lançamento aprovado." : "Lançamento cancelado.");
        router.refresh();
      }
    });
  }

  const counted = purchases.filter((p) => p.status === "registrada");
  const total = counted.reduce((s, p) => s + p.total_amount, 0);

  if (purchases.length === 0) {
    return <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma compra ou despesa neste mês.</p>;
  }

  return (
    <div className="space-y-2">
      {purchases.map((p) => {
        const pending = p.status === "pendente_aprovacao";
        const cancelled = p.status === "cancelada";
        return (
          <div
            key={p.id}
            className={`rounded-lg border p-3 text-sm ${
              pending ? "border-red-500 bg-red-500/10" : "border-border bg-card"
            } ${cancelled ? "opacity-50 line-through" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {dmy(p.date)} · {p.supplier_name || "Sem fornecedor"}
                {p.document_number ? ` · nota ${p.document_number}` : ""}
              </p>
              <p className="font-medium">{brl(p.total_amount)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {p.posted_after_close && !pending && (
                <span className="text-xs rounded bg-amber-500/20 px-1.5 py-0.5">Lançado após o fechamento do mês</span>
              )}
              {pending && <span className="text-xs rounded bg-red-500/20 px-1.5 py-0.5">Mais de 30 dias após o fechamento — aguarda aprovação</span>}
              {cancelled && <span className="text-xs rounded bg-muted px-1.5 py-0.5">Cancelado</span>}
              {p.source !== "manual" && (
                <span className="text-xs rounded bg-muted px-1.5 py-0.5">{p.source === "whatsapp" ? "WhatsApp" : "Recorrente"}</span>
              )}
              {p.payment_method && <span className="text-xs rounded bg-muted px-1.5 py-0.5">{p.payment_method}</span>}
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {p.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span>
                    {l.description} — {l.is_asset ? "Ativo permanente" : (l.category_name ?? "Sem categoria")}
                    {l.ingredient_name ? ` (ingrediente: ${l.ingredient_name})` : ""}
                  </span>
                  <span>{brl(l.amount)}</span>
                </li>
              ))}
            </ul>
            {pending && isAdmin && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" disabled={isPending} onClick={() => decide(p.id, "aprovar")}>
                  Aprovar
                </Button>
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => decide(p.id, "cancelar")}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-sm text-right pt-2">
        Total do mês (sem cancelados e pendentes): <strong>{brl(total)}</strong>
      </p>
    </div>
  );
}

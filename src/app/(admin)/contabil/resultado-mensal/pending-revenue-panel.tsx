"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveLodgingDifference, decideLateRevenue } from "@/lib/actions/monthly-result";
import type { MonthlyResult } from "@/lib/monthly-result-types";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PendingRevenuePanel({ result }: { result: MonthlyResult }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    startTransition(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-lg border border-red-500 bg-red-500/10 p-4 space-y-3">
      <h3 className="font-heading text-lg">Aguardando aprovação do admin</h3>
      <p className="text-xs text-muted-foreground">
        Receitas que chegaram mais de 30 dias depois do fim do mês. Só entram no resultado se você aprovar.
      </p>
      {result.lodging.pendingDiff && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Hospedagem: a Stays corrigiu o mês depois do prazo (bruta {brl(result.lodging.pendingDiff.gross)}, comissão{" "}
            {brl(result.lodging.pendingDiff.commission)}).
          </span>
          <Button size="sm" disabled={isPending} onClick={() => run(() => approveLodgingDifference(result.month), "Correção aprovada.")}>
            Aceitar correção
          </Button>
        </div>
      )}
      {result.pendingRevenue.map((p) => (
        <div key={`${p.bill_id}:${p.kind}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {p.kind === "bar" ? "Bar" : "Frigobar"} · {p.guest ?? "conta"} · {brl(p.amount)}
            {p.closed_day ? ` · conta fechada em ${p.closed_day.split("-").reverse().join("/")}` : ""}
          </span>
          <span className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={() => run(() => decideLateRevenue(p.bill_id, result.month, "aprovada"), "Receita aprovada.")}>
              Aprovar
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => decideLateRevenue(p.bill_id, result.month, "cancelada"), "Receita cancelada.")}>
              Cancelar
            </Button>
          </span>
        </div>
      ))}
    </section>
  );
}

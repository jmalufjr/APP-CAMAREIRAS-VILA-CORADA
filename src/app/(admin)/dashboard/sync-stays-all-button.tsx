"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncStaysAll } from "@/lib/actions/stays-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Gatilho manual único da sincronização com a Stays (Planejamento Diário +
// Chegadas & Saídas + Mesas do Café, hoje + amanhã, numa única chamada) —
// antes existia um botão por tela (Planejamento, Chegadas & Saídas, Mesas
// do Café), cada um sincronizando só o próprio domínio; unificados aqui
// porque não há nenhum motivo pra separar o gatilho manual em três lugares
// quando o cron diário já sempre rodou as três sincronizações juntas (ver
// src/app/api/cron/stays-sync/route.ts). Desde então, existe também a
// sincronização automática por cron (não forçada, respeita a regra de
// preferência).
//
// Dois botões:
// - "Sincronização Stays Total": ignora qualquer edição do admin
//   (`stays_locked`) nas três telas e sobrescreve com os dados da Stays
//   mesmo assim — nunca, porém, um serviço já reivindicado/em andamento/
//   concluído/cancelado por uma camareira.
// - "Sincronização Stays Parcial": roda a sincronização imediatamente
//   (sem esperar o cron do dia), mas continua respeitando `stays_locked`
//   nas três telas — só preenche os campos que o admin ainda não editou
//   hoje/amanhã.
export function SyncStaysAllButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function runSync(force: boolean) {
    startTransition(async () => {
      const result = await syncStaysAll({ force });
      const parts = [
        { label: "Planejamento Diário", r: result.planning },
        { label: "Chegadas & Saídas", r: result.arrivalsDepartures },
        { label: "Mesas do Café", r: result.breakfastTables },
      ];

      const failed = parts.filter((p) => "error" in p.r);
      if (failed.length > 0) {
        toast.error(failed.map((p) => `${p.label}: ${(p.r as { error: string }).error}`).join(" · "));
      }

      const ok = parts.filter((p) => !("error" in p.r)) as {
        label: string;
        r: { success: true; updated: number; skipped: number; errors?: number };
      }[];
      const totals = ok.reduce(
        (acc, p) => {
          acc.updated += p.r.updated;
          acc.skipped += p.r.skipped;
          acc.errors += p.r.errors ?? 0;
          return acc;
        },
        { updated: 0, skipped: 0, errors: 0 }
      );

      if (totals.errors > 0) {
        toast.error(
          `Sincronizado com ${totals.errors} erro(s): ${totals.updated} atualizado(s), ${totals.skipped} preservado(s). Veja o console/logs para detalhes.`
        );
      } else if (failed.length === 0) {
        toast.success(`Sincronizado: ${totals.updated} atualizado(s), ${totals.skipped} preservado(s).`);
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (
            !confirm(
              "Isso vai forçar a sincronização com a Stays no Planejamento Diário, em Chegadas & Saídas e em Mesas do Café, sobrescrevendo qualquer edição manual sua em campos sincronizados nas três telas. Continuar?"
            )
          )
            return;
          runSync(true);
        }}
      >
        <RefreshCw size={14} className={isPending ? "animate-spin" : undefined} />
        Sincronização Stays Total - sobrescreve alterações inseridas pelo Admin
      </Button>
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => runSync(false)}>
        <RefreshCw size={14} className={isPending ? "animate-spin" : undefined} />
        Sincronização Stays Parcial - preserva alterações inseridas pelo Admin
      </Button>
    </div>
  );
}

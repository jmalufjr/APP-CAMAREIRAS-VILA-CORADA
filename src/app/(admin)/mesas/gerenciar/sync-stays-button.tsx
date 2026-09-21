"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncStaysBreakfastTables } from "@/lib/actions/stays-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Gatilho manual da sincronização de Mesas do Café com a Stays (hoje +
// amanhã) — distribui as suítes ocupadas entre as mesas por proximidade da
// vista do mar (ver PRD_regrasdenegocio.md seção 4). Desde a Parte 14,
// existe também uma sincronização automática por cron (não forçada,
// respeita a regra de preferência).
//
// Dois botões manuais, além dela:
// - "Forçar sincronização": ignora qualquer edição do admin (`stays_locked`,
//   inclusive a alocação de suítes por mesa) e sobrescreve com os dados da
//   Stays mesmo assim.
// - "Sincronizar agora": roda a sincronização imediatamente (sem esperar o
//   cron do dia), mas continua respeitando `stays_locked` — só preenche as
//   mesas que o admin ainda não editou hoje/amanhã.
export function SyncStaysButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function runSync(force: boolean) {
    startTransition(async () => {
      const result = await syncStaysBreakfastTables({ force });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if ((result.errors ?? 0) > 0) {
        toast.error(
          `Sincronizado com ${result.errors} erro(s): ${result.updated} atualizado(s), ${result.skipped} preservado(s). Veja o console/logs para detalhes.`
        );
      } else {
        toast.success(`Sincronizado: ${result.updated} atualizado(s), ${result.skipped} preservado(s).`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (
            !confirm(
              "Isso vai forçar a sincronização com a Stays, sobrescrevendo qualquer edição manual sua em campos sincronizados (alocação de suítes nas mesas, hóspedes por mesa, contagens por tamanho de mesa). Continuar?"
            )
          )
            return;
          runSync(true);
        }}
      >
        <RefreshCw size={14} className={isPending ? "animate-spin" : undefined} />
        Forçar sincronização com a Stays
      </Button>
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => runSync(false)}>
        <RefreshCw size={14} className={isPending ? "animate-spin" : undefined} />
        Sincronizar agora (preserva edições)
      </Button>
    </div>
  );
}

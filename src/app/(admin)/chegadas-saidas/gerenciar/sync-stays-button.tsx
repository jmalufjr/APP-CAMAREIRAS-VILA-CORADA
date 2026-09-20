"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncStaysArrivalsDepartures } from "@/lib/actions/stays-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Gatilho manual da sincronização de Chegadas & Saídas com a Stays (hoje +
// amanhã) — ver PRD_regrasdenegocio.md seção 3. Desde a Parte 14, existe
// também uma sincronização automática por cron (não forçada, respeita a
// regra de preferência).
//
// Dois botões manuais, além dela:
// - "Forçar sincronização": ignora qualquer edição do admin (`stays_locked`)
//   e sobrescreve com os dados da Stays mesmo assim.
// - "Sincronizar agora": roda a sincronização imediatamente (sem esperar o
//   cron do dia), mas continua respeitando `stays_locked` — só preenche
//   os campos que o admin ainda não editou hoje/amanhã.
export function SyncStaysButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function runSync(force: boolean) {
    startTransition(async () => {
      const result = await syncStaysArrivalsDepartures({ force });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sincronizado: ${result.updated} atualizado(s), ${result.skipped} preservado(s).`);
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
              "Isso vai forçar a sincronização com a Stays, sobrescrevendo qualquer edição manual sua em campos sincronizados (nome/noites/hóspedes de chegadas, suítes de saída). Continuar?"
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

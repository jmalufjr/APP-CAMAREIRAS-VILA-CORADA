"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncStaysPlanning } from "@/lib/actions/stays-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Gatilho manual da sincronização do Planejamento Diário com a Stays (hoje
// + amanhã) — ver PRD_regrasdenegocio.md seção 2. Chegadas & Saídas e
// Mesas do Café têm seus próprios botões nas respectivas telas (ver Parte
// 13 do CLAUDE.md). Desde a Parte 14, existe também uma sincronização
// automática por cron (não forçada, respeita a regra de preferência).
//
// Dois botões manuais, além dela:
// - "Forçar sincronização": ignora qualquer edição do admin (`stays_locked`)
//   e sobrescreve com os dados da Stays mesmo assim — nunca, porém, um
//   serviço já reivindicado/em andamento/concluído/cancelado por uma
//   camareira.
// - "Sincronizar agora": roda a sincronização imediatamente (sem esperar o
//   cron do dia), mas continua respeitando `stays_locked` — só preenche
//   os campos que o admin ainda não editou hoje/amanhã.
export function SyncStaysButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function runSync(force: boolean) {
    startTransition(async () => {
      const result = await syncStaysPlanning({ force });
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
              "Isso vai forçar a sincronização com a Stays, sobrescrevendo qualquer edição manual sua em campos sincronizados (Arrumação/Troca/etc. de suítes ainda não reivindicadas por uma camareira). Continuar?"
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

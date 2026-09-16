"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncStaysPlanning } from "@/lib/actions/stays-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Gatilho manual da sincronização com a Stays (hoje + amanhã) — ver
// PRD_regrasdenegocio.md. Fase 1 da integração: só Planejamento Diário por
// enquanto (Chegadas & Saídas e Mesas do Café ainda não sincronizam).
export function SyncStaysButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncStaysPlanning();
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`Sincronizado: ${result.updated} atualizado(s), ${result.skipped} preservado(s).`);
          router.refresh();
        })
      }
    >
      <RefreshCw size={14} className={isPending ? "animate-spin" : undefined} />
      Sincronizar com a Stays
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncStaysBreakfastTables } from "@/lib/actions/stays-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Gatilho manual da sincronização de Mesas do Café com a Stays (hoje +
// amanhã) — distribui as suítes ocupadas entre as mesas por proximidade da
// vista do mar (ver PRD_regrasdenegocio.md seção 4).
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
          const result = await syncStaysBreakfastTables();
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

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshIndicatorsFull } from "@/lib/actions/indicators";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshIndicatorsFull();
          if ("error" in result && result.error) toast.error(result.error);
          else toast.success("Histórico completo atualizado.");
          router.refresh();
        })
      }
    >
      <RefreshCw size={16} /> {isPending ? "Atualizando..." : "Atualizar histórico completo"}
    </Button>
  );
}

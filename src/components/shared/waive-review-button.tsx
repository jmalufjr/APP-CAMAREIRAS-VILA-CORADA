"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { waiveReview } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";

// Admin / gerente operacional dispensam a revisão de um serviço pendente de revisão
// (o serviço passa direto a concluído — PRD_camareira_revisora.md).
export function WaiveReviewButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Dispensar a revisão deste serviço? Ele será marcado como concluído, sem revisora.")) return;
        startTransition(async () => {
          const r = await waiveReview(taskId);
          if (r?.error) toast.error(r.error);
          else {
            toast.success("Revisão dispensada — serviço concluído.");
            router.refresh();
          }
        });
      }}
    >
      Dispensar revisão
    </Button>
  );
}

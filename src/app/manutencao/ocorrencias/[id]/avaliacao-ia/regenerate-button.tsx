"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { regenerateOccurrenceAssessment } from "@/lib/actions/occurrence-ai";

// Pede uma avaliação nova (a anterior fica guardada até lá; só gasta a IA quando a pessoa pede).
export function RegenerateButton({ occurrenceId }: { occurrenceId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await regenerateOccurrenceAssessment(occurrenceId);
          if (res?.error) toast.error(res.error);
          else router.refresh();
        })
      }
    >
      {isPending ? "Analisando…" : "Gerar avaliação novamente"}
    </Button>
  );
}

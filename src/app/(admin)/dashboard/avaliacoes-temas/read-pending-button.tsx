"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { processPendingReviewTopics } from "@/lib/actions/stays-reviews";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function ReadPendingButton({ pending }: { pending: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await processPendingReviewTopics();
      if (!("success" in result)) {
        toast.error(result.error);
      } else {
        toast.success(`${result.processed} avaliação(ões) lida(s) pela IA.${result.remaining > 0 ? ` Ainda restam ${result.remaining}.` : ""}`);
      }
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={run} disabled={isPending || pending === 0}>
      <Sparkles size={16} /> {isPending ? "Lendo..." : `Ler comentários pendentes com a IA (${pending})`}
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startCountSession } from "@/lib/actions/inventory-counts";
import { Button } from "@/components/ui/button";

export function StartCountButton({ categoryId, label }: { categoryId?: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await startCountSession(categoryId);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          router.push(`/compras/contagem/${result.sessionId}`);
        });
      }}
    >
      {label}
    </Button>
  );
}

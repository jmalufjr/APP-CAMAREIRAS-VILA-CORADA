"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteButton({ action }: { action: () => Promise<{ error?: string }> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Tem certeza? Essa ação não pode ser desfeita.")) return;
        startTransition(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
          else {
            toast.success("Removido.");
            router.refresh();
          }
        });
      }}
    >
      <Trash2 size={14} />
    </Button>
  );
}

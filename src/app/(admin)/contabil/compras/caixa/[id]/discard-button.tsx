"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { discardInboxItem } from "@/lib/actions/purchase-inbox";

export function DiscardButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Descartar esta mensagem? Ela não será lançada como compra.")) return;
        startTransition(async () => {
          const r = await discardInboxItem(id);
          if (r?.error) toast.error(r.error);
          else {
            toast.success("Mensagem descartada.");
            router.push("/contabil/compras/caixa");
          }
        });
      }}
    >
      Não é compra — descartar
    </Button>
  );
}

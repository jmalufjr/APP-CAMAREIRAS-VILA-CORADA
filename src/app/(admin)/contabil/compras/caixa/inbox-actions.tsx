"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { discardInboxItem, quickSaveInboxItem } from "@/lib/actions/purchase-inbox";

export function InboxActions({ id, canRecurring, needsReview = false }: { id: string; canRecurring: boolean; needsReview?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [recurring, setRecurring] = useState(false);

  function save() {
    startTransition(async () => {
      const r = await quickSaveInboxItem(id, recurring);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(recurring ? "Lançada e cadastrada como recorrente." : "Compra lançada.");
        if (r.message) toast.info(r.message);
        router.refresh();
      }
    });
  }

  function discard() {
    if (!confirm("Descartar esta mensagem? Ela não será lançada como compra.")) return;
    startTransition(async () => {
      const r = await discardInboxItem(id);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Mensagem descartada.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-2">
      {canRecurring && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Despesa recorrente
        </label>
      )}
      {needsReview && <span className="text-xs text-amber-700 dark:text-amber-400">Conferir: abra o item (destino do custo incerto)</span>}
      <Button size="sm" disabled={isPending || needsReview} onClick={save} title={needsReview ? "Abra o item para conferir categoria e ingrediente" : undefined}>
        {isPending ? "..." : "Salvar"}
      </Button>
      <Button size="icon-sm" variant="outline" disabled={isPending} onClick={discard} aria-label="Descartar">
        <X size={14} />
      </Button>
    </div>
  );
}

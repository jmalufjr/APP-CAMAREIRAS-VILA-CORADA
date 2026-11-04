"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveReviewReply } from "@/lib/actions/stays-reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquareReply } from "lucide-react";

// Resposta do admin/gerente a uma avaliação. Fica registrada no app (quem respondeu e quando); não é
// publicada no canal de venda.
export function ReplyBox({
  reviewId,
  initialText,
  repliedByName,
  repliedAtLabel,
}: {
  reviewId: string;
  initialText: string | null;
  repliedByName: string | null;
  repliedAtLabel: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialText ?? "");

  function save() {
    startTransition(async () => {
      const result = await saveReviewReply(reviewId, text);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(text.trim() ? "Resposta salva." : "Resposta removida.");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="space-y-1.5 border-t border-border pt-2">
        {initialText && (
          <div className="rounded-lg bg-muted/40 p-2.5 text-sm">
            <p className="text-xs text-muted-foreground">
              Resposta{repliedByName ? ` de ${repliedByName}` : ""}
              {repliedAtLabel ? ` · ${repliedAtLabel}` : ""}
            </p>
            <p className="whitespace-pre-wrap">{initialText}</p>
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <MessageSquareReply size={14} /> {initialText ? "Editar resposta" : "Responder"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-border pt-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Escreva a resposta a esta avaliação" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar resposta"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setText(initialText ?? "");
            setOpen(false);
          }}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">A resposta fica registrada aqui no app; ela não é enviada ao Booking, Airbnb ou Expedia.</p>
    </div>
  );
}

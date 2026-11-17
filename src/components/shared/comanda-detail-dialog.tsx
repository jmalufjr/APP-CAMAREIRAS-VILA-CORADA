"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ComandaListItem } from "@/lib/actions/comandas";
import { comandaDisplayStatus } from "@/lib/comanda-status";
import { formatDateTimePt } from "@/lib/date";

const ACTION_LABELS = { lancada: "lançou", editada: "editou", cancelada: "cancelou" } as const;
function itemsText(items: { item: string; quantity: number }[] | null): string {
  if (!items || items.length === 0) return "nenhum item";
  return items.map((i) => `${i.item} ×${i.quantity}`).join(", ");
}

// Conteúdo de uma comanda (itens, total, histórico e assinatura) — usado na janela e na página da comanda.
export function ComandaDetailBody({ comanda }: { comanda: ComandaListItem }) {
  return (
      <div className="space-y-3">
        <Badge variant={comanda.status === "cancelada" ? "secondary" : "outline"}>
          {comandaDisplayStatus(comanda)}
        </Badge>
        <div className="space-y-1.5">
          {comanda.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span>
                {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
              </span>
              <span>R$ {item.subtotal.toFixed(2)}</span>
            </div>
          ))}
          {comanda.items.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">Nenhum item registrado.</p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 font-medium text-sm">
          <span>Total</span>
          <span>R$ {comanda.total.toFixed(2)}</span>
        </div>
        <div className="space-y-1.5 border-t border-border pt-2">
          <p className="text-xs font-medium text-muted-foreground">Histórico da comanda</p>
          {comanda.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico registrado (comanda anterior ao recurso).</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {comanda.history.map((h) => (
                <li key={h.id}>
                  <span className="font-medium">{formatDateTimePt(h.occurredAt)} — {h.actorName} {ACTION_LABELS[h.action]}</span>
                  {h.action === "lancada" && <span className="text-muted-foreground">: {itemsText(h.after)}</span>}
                  {h.action === "editada" && (
                    <span className="block text-muted-foreground">antes: {itemsText(h.before)} → depois: {itemsText(h.after)}</span>
                  )}
                  {h.action === "cancelada" && <span className="text-muted-foreground">: {itemsText(h.before)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-1.5 border-t border-border pt-2">
          <p className="text-xs font-medium text-muted-foreground">Assinatura do hóspede</p>
          {comanda.signaturePng ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={comanda.signaturePng}
                alt="Assinatura do hóspede"
                className="w-full rounded-lg border border-border bg-white"
              />
              {comanda.signedAt && (
                <p className="text-xs text-muted-foreground">Assinado em {formatDateTimePt(comanda.signedAt)}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem assinatura registrada.</p>
          )}
        </div>
      </div>
  );
}

export function ComandaDetailDialog({
  comanda,
  onOpenChange,
}: {
  comanda: ComandaListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={comanda !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {comanda ? `Comanda #${comanda.monthly_number ?? comanda.sequence_number} · Suíte ${comanda.room_number}` : "Comanda"}
          </DialogTitle>
        </DialogHeader>
        {comanda && <ComandaDetailBody comanda={comanda} />}
      </DialogContent>
    </Dialog>
  );
}

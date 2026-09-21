"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ComandaListItem } from "@/lib/actions/comandas";
import { comandaDisplayStatus } from "@/lib/comanda-status";

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
        {comanda && (
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

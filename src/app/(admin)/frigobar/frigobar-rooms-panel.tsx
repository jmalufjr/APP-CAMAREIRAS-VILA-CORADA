"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoomBillOverview } from "@/lib/actions/room-bills";
import { closeRoomBill, reopenRoomBill, markRoomBillPaid } from "@/lib/actions/room-bills";
import { setMinibarConsumption } from "@/lib/actions/minibar";
import { setPoolbarConsumption } from "@/lib/actions/poolbar";
import type { MinibarItem, PoolbarItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { formatDateShortPt } from "@/lib/date";

export function FrigobarRoomsPanel({
  overview,
  minibarItems,
  poolbarItems,
}: {
  overview: RoomBillOverview[];
  minibarItems: MinibarItem[];
  poolbarItems: PoolbarItem[];
}) {
  if (overview.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum quarto ativo cadastrado.</p>;
  }

  return (
    <Accordion className="space-y-2">
      {overview.map((room) => (
        <RoomAccordionItem key={room.room_id} room={room} minibarItems={minibarItems} poolbarItems={poolbarItems} />
      ))}
    </Accordion>
  );
}

function RoomAccordionItem({
  room,
  minibarItems,
  poolbarItems,
}: {
  room: RoomBillOverview;
  minibarItems: MinibarItem[];
  poolbarItems: PoolbarItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const initialMinibarQty = Object.fromEntries(
    minibarItems.map((item) => [item.id, room.minibarItems.find((i) => i.id === item.id)?.quantity ?? 0])
  );
  const initialPoolbarQty = Object.fromEntries(
    poolbarItems.map((item) => [item.id, room.poolbarItems.find((i) => i.id === item.id)?.quantity ?? 0])
  );
  const [minibarQty, setMinibarQty] = useState<Record<string, number>>(initialMinibarQty);
  const [poolbarQty, setPoolbarQty] = useState<Record<string, number>>(initialPoolbarQty);

  function runAction(action: () => Promise<{ error?: string } | undefined>, successMessage?: string) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else {
        if (successMessage) toast.success(successMessage);
        router.refresh();
      }
    });
  }

  return (
    <AccordionItem value={room.room_id}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-heading text-base">Quarto {room.room_number}</span>
          {room.status === "fechada" && <Badge variant="secondary">Conta fechada</Badge>}
          {room.status === "reaberta" && <Badge variant="outline">Conta reaberta</Badge>}
        </span>
        <span className="text-xs text-muted-foreground mr-2">R$ {room.grandTotal.toFixed(2)}</span>
      </AccordionTrigger>
      <AccordionPanel>
        <div className="space-y-3 pt-3">
          {room.status === "reaberta" ? (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Frigobar</p>
                {/* Rolagem horizontal própria: em telas estreitas, se o nome
                    não couber ao lado do campo de quantidade, dá pra
                    arrastar em vez do campo ficar inacessível. */}
                <div className="overflow-x-auto">
                  <div className="space-y-1.5">
                    {minibarItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm w-max min-w-full">
                        <span className="shrink-0 whitespace-nowrap">{item.name}</span>
                        <Input
                          type="number"
                          min={0}
                          className="w-16 h-8 shrink-0 ml-auto"
                          disabled={isPending}
                          value={minibarQty[item.id] ?? 0}
                          onChange={(e) => setMinibarQty((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                          onBlur={() =>
                            runAction(() => setMinibarConsumption(room.room_id, item.id, minibarQty[item.id] ?? 0))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Bar da piscina</p>
                <div className="overflow-x-auto">
                  <div className="space-y-1.5">
                    {poolbarItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm w-max min-w-full">
                        <span className="shrink-0 whitespace-nowrap">{item.name}</span>
                        <Input
                          type="number"
                          min={0}
                          className="w-16 h-8 shrink-0 ml-auto"
                          disabled={isPending}
                          value={poolbarQty[item.id] ?? 0}
                          onChange={(e) => setPoolbarQty((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                          onBlur={() =>
                            runAction(() => setPoolbarConsumption(room.room_id, item.id, poolbarQty[item.id] ?? 0))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {room.minibarItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span>
                    {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                  </span>
                  <span>R$ {item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              {room.poolbarItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span>
                    {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                  </span>
                  <span>R$ {item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              {room.minibarItems.length === 0 && room.poolbarItems.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Sem consumo em aberto.</p>
              )}
            </div>
          )}

          <div className="border-t border-border pt-2 space-y-1 text-sm max-w-md">
            <div className="flex items-center justify-between">
              <span>Total frigobar</span>
              <span>R$ {room.minibarTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total bar da piscina</span>
              <span>R$ {room.poolbarSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Taxa de serviço (10% sobre o bar)</span>
              <span>R$ {room.serviceCharge.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Bar da piscina com taxa</span>
              <span>R$ {room.poolbarTotalWithCharge.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-medium pt-1">
              <span>Total bar e frigobar</span>
              <span>R$ {room.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="max-w-md space-y-2">
            {room.status === "fechada" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => runAction(() => markRoomBillPaid(room.room_id), "Pagamento registrado.")}
                >
                  Pagamento efetuado
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => runAction(() => reopenRoomBill(room.room_id), "Conta reaberta.")}
                >
                  Editar/reabrir conta
                </Button>
              </div>
            )}

            {(room.status === "aberta" || room.status === "reaberta") && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => runAction(() => closeRoomBill(room.room_id), "Conta fechada.")}
              >
                Fechar a conta
              </Button>
            )}

            {room.lastPaidBill && (
              <p className="text-xs text-muted-foreground">
                Última conta paga: R$ {room.lastPaidBill.total.toFixed(2)} em{" "}
                {formatDateShortPt(room.lastPaidBill.paid_at.slice(0, 10))}
              </p>
            )}
          </div>
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}

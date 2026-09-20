"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoomBillOverview } from "@/lib/actions/room-bills";
import { closeRoomBill, reopenRoomBill, markRoomBillPaid } from "@/lib/actions/room-bills";
import { setMinibarConsumption } from "@/lib/actions/minibar";
import type { MinibarItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { formatDateShortPt } from "@/lib/date";

export function ConsumoQuartosPanel({
  overview,
  minibarItems,
}: {
  overview: RoomBillOverview[];
  minibarItems: MinibarItem[];
}) {
  if (overview.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma suíte ativa cadastrada.</p>;
  }

  return (
    <Accordion className="space-y-2">
      {overview.map((room) => (
        <RoomAccordionItem key={room.room_id} room={room} minibarItems={minibarItems} />
      ))}
    </Accordion>
  );
}

function RoomAccordionItem({ room, minibarItems }: { room: RoomBillOverview; minibarItems: MinibarItem[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const initialMinibarQty = Object.fromEntries(
    minibarItems.map((item) => [item.id, room.minibarItems.find((i) => i.id === item.id)?.quantity ?? 0])
  );
  const [minibarQty, setMinibarQty] = useState<Record<string, number>>(initialMinibarQty);
  // Antes de fechar a conta (status "aberta"), a camareira decide
  // explicitamente se houve consumo no último dia — só então os steppers de
  // quantidade aparecem, com o mesmo mecanismo já usado quando a conta está
  // reaberta. Começa marcado quando já existe algum consumo lançado nessa
  // conta (ex.: ela volta à tela no meio da edição).
  const [hasConsumption, setHasConsumption] = useState(room.minibarItems.length > 0);

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
          <span className="font-heading text-base">Suíte {room.room_number}</span>
          {room.status === "fechada" && <Badge variant="secondary">Conta fechada</Badge>}
          {room.status === "reaberta" && <Badge variant="outline">Conta reaberta</Badge>}
        </span>
        <span className="text-xs text-muted-foreground mr-2">R$ {room.grandTotal.toFixed(2)}</span>
      </AccordionTrigger>
      <AccordionPanel>
        <div className="space-y-3 pt-3">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Frigobar</p>
                {room.status === "aberta" && (
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`has-consumption-${room.room_id}`}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Houve consumo no último dia?
                    </Label>
                    <Switch
                      id={`has-consumption-${room.room_id}`}
                      checked={hasConsumption}
                      disabled={isPending}
                      onCheckedChange={(checked) => setHasConsumption(!!checked)}
                    />
                  </div>
                )}
              </div>
              {room.status === "reaberta" || (room.status === "aberta" && hasConsumption) ? (
                <div className="space-y-1.5">
                  {minibarItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                      <span className="min-w-0">{item.name}</span>
                      <QuantityStepper
                        value={minibarQty[item.id] ?? 0}
                        disabled={isPending}
                        onChange={(v) => {
                          setMinibarQty((prev) => ({ ...prev, [item.id]: v }));
                          runAction(() => setMinibarConsumption(room.room_id, item.id, v));
                        }}
                      />
                    </div>
                  ))}
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
                  {room.minibarItems.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">Sem consumo em aberto.</p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Bar da piscina <span className="font-normal">(via comandas)</span>
              </p>
              <div className="space-y-1.5">
                {room.poolbarItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span>
                      {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                    </span>
                    <span>R$ {item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                {room.poolbarItems.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Nenhuma comanda ativa para esta suíte.</p>
                )}
              </div>
            </div>
          </div>

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
                  onClick={() => router.push(`/bar-piscina/pix/${room.room_id}`)}
                >
                  Pagar com PIX
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

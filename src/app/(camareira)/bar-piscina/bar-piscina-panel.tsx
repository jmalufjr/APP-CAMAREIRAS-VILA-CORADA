"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PoolbarRoomCard } from "@/lib/actions/poolbar";
import { setPoolbarConsumption } from "@/lib/actions/poolbar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function BarPiscinaPanel({ rooms }: { rooms: PoolbarRoomCard[] }) {
  if (rooms.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum quarto ativo cadastrado.</p>;
  }

  return (
    <Accordion className="space-y-2">
      {rooms.map((room) => (
        <RoomAccordionItem key={room.room_id} room={room} />
      ))}
    </Accordion>
  );
}

function RoomAccordionItem({ room }: { room: PoolbarRoomCard }) {
  const [, startTransition] = useTransition();
  const isClosed = room.billStatus === "fechada";
  const isReopened = room.billStatus === "reaberta";

  const initialQuantities = Object.fromEntries(room.items.map((item) => [item.id, item.quantity]));
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);
  const [hasConsumption, setHasConsumption] = useState(Object.values(initialQuantities).some((q) => q > 0));
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  function handleQuantityChange(itemId: string, quantity: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(0, Math.floor(quantity) || 0) }));
  }

  function saveQuantity(itemId: string, quantity: number) {
    setPendingIds((prev) => new Set(prev).add(itemId));
    startTransition(async () => {
      const result = await setPoolbarConsumption(room.room_id, itemId, quantity);
      setPendingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(itemId);
        return copy;
      });
      if (result?.error) toast.error(result.error);
    });
  }

  const totalItemsWithConsumption = room.items.filter((i) => i.quantity > 0).length;

  const groups = new Map<string, typeof room.items>();
  room.items.forEach((item) => {
    const key = item.category ?? "Outros";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });

  return (
    <AccordionItem value={room.room_id}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-heading text-base">Quarto {room.room_number}</span>
          {isClosed && <Badge variant="secondary">Conta fechada</Badge>}
          {isReopened && <Badge variant="outline">Conta reaberta</Badge>}
        </span>
        {totalItemsWithConsumption > 0 && (
          <span className="text-xs text-muted-foreground mr-2">
            {totalItemsWithConsumption} {totalItemsWithConsumption === 1 ? "item" : "itens"} com consumo
          </span>
        )}
      </AccordionTrigger>
      <AccordionPanel>
        <div className="space-y-4 pt-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={`consumption-${room.room_id}`} className="text-sm font-normal">
              Houve consumo de bar?
            </Label>
            <Switch
              id={`consumption-${room.room_id}`}
              checked={hasConsumption}
              disabled={isClosed}
              onCheckedChange={(checked) => {
                setHasConsumption(!!checked);
                if (!checked) {
                  room.items.forEach((item) => {
                    if ((quantities[item.id] ?? 0) > 0) {
                      handleQuantityChange(item.id, 0);
                      saveQuantity(item.id, 0);
                    }
                  });
                }
              }}
            />
          </div>
          {hasConsumption && (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              {Array.from(groups.entries()).map(([category, items]) => (
                <div key={category} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{category}</p>
                  {/* Coluna do nome usa minmax(0,1fr): encolhe e quebra em
                      várias linhas se precisar, mas a caixa de quantidade
                      (coluna auto) fica sempre visível — sem depender de
                      arrastar a tela pra o lado. */}
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <div className="min-w-0">
                          <p className="text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">R$ {item.price.toFixed(2)}</p>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          className="w-16 shrink-0"
                          disabled={isClosed || pendingIds.has(item.id)}
                          value={quantities[item.id] ?? 0}
                          onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                          onBlur={() => saveQuantity(item.id, quantities[item.id] ?? 0)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {room.items.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum item de bar cadastrado.</p>
              )}
            </div>
          )}
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}

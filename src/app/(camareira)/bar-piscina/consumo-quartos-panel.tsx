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
  const zeroQty = Object.fromEntries(minibarItems.map((item) => [item.id, 0]));

  // "aberta": a camareira opta por lançar consumo adicional antes de fechar
  // a conta pela primeira vez. Começa sempre desligado — é uma ação que ela
  // escolhe fazer, não uma pergunta sobre o que já existe na conta.
  const [isLaunchingAdditional, setIsLaunchingAdditional] = useState(false);

  // "reaberta": edição sempre disponível; por padrão soma ao que já existe
  // (aditivo). A camareira pode optar por zerar e relançar tudo do zero
  // ("integral") — essa escolha nunca é persistida: volta a ser aditiva
  // sempre que a conta passa por um novo ciclo fechar -> reabrir.
  const [isIntegralMode, setIsIntegralMode] = useState(false);

  // Base sobre a qual os steppers somam (modo aditivo): o total que já
  // existia no momento em que a edição começou. O que o stepper mostra é
  // só a quantidade sendo adicionada agora (autônomo, sempre começa em
  // zero) — o valor salvo é sempre base + o que está no stepper.
  const [baseQty, setBaseQty] = useState<Record<string, number>>(initialMinibarQty);
  const [additionalQty, setAdditionalQty] = useState<Record<string, number>>(zeroQty);

  // Detecta uma reabertura de verdade (não um refresh qualquer com a conta
  // já reaberta) pra resetar o modo "integral" e recapturar a base — sem
  // useEffect, mesmo padrão de "ajustar estado durante a renderização" já
  // usado no resto do app (ex.: checklist-detail.tsx).
  const [trackedStatus, setTrackedStatus] = useState(room.status);
  if (room.status !== trackedStatus) {
    setTrackedStatus(room.status);
    if (room.status === "reaberta") {
      setIsIntegralMode(false);
      setBaseQty(initialMinibarQty);
      setAdditionalQty(zeroQty);
    }
  }

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

  // Salva sempre base + o que está no stepper — por isso o consumo lançado
  // aqui soma ao que a camareira já tinha lançado durante o serviço na
  // suíte, em vez de sobrescrevê-lo.
  function handleAdditionalChange(itemId: string, v: number) {
    setAdditionalQty((prev) => ({ ...prev, [itemId]: v }));
    runAction(() => setMinibarConsumption(room.room_id, itemId, (baseQty[itemId] ?? 0) + v));
  }

  function handleStartLaunchingAdditional(checked: boolean) {
    setIsLaunchingAdditional(checked);
    if (checked) {
      setBaseQty(initialMinibarQty);
      setAdditionalQty(zeroQty);
    }
  }

  function handleToggleIntegralMode(checked: boolean) {
    if (checked) {
      if (
        !confirm(
          "Isso vai zerar todo o consumo de frigobar já lançado nessa conta, para lançar tudo novamente do zero. Confirma?"
        )
      ) {
        return;
      }
      startTransition(async () => {
        const results = await Promise.all(
          minibarItems.map((item) => setMinibarConsumption(room.room_id, item.id, 0))
        );
        const failed = results.find((r) => r?.error);
        if (failed?.error) {
          toast.error(failed.error);
          return;
        }
        setIsIntegralMode(true);
        setBaseQty(zeroQty);
        setAdditionalQty(zeroQty);
        router.refresh();
      });
    } else {
      // Volta a ser aditivo, preservando o que já está lançado agora (não
      // volta pro valor de antes de entrar no modo integral).
      setIsIntegralMode(false);
      setBaseQty(initialMinibarQty);
      setAdditionalQty(zeroQty);
    }
  }

  const showEditableMinibar =
    room.status === "reaberta" || (room.status === "aberta" && isLaunchingAdditional);

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
                      htmlFor={`launch-additional-${room.room_id}`}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Lançar consumo adicional
                    </Label>
                    <Switch
                      id={`launch-additional-${room.room_id}`}
                      checked={isLaunchingAdditional}
                      disabled={isPending}
                      onCheckedChange={(checked) => handleStartLaunchingAdditional(!!checked)}
                    />
                  </div>
                )}
              </div>
              {room.status === "reaberta" && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Lançamento adicional de consumo</p>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`zero-relaunch-${room.room_id}`}
                      checked={isIntegralMode}
                      disabled={isPending}
                      onCheckedChange={(checked) => handleToggleIntegralMode(!!checked)}
                    />
                    <Label
                      htmlFor={`zero-relaunch-${room.room_id}`}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Selecione aqui apenas se quiser zerar o consumo de frigobar e lançar todo o consumo
                      novamente
                    </Label>
                  </div>
                </div>
              )}
              {showEditableMinibar ? (
                <div className="space-y-1.5">
                  {minibarItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                      <span className="min-w-0">{item.name}</span>
                      <QuantityStepper
                        value={additionalQty[item.id] ?? 0}
                        disabled={isPending}
                        onChange={(v) => handleAdditionalChange(item.id, v)}
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

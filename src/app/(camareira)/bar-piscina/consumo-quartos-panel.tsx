"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoomBillOverview } from "@/lib/actions/room-bills";
import { closeRoomBill, reopenRoomBill, markRoomBillPaid, setServiceChargeWaived } from "@/lib/actions/room-bills";
import { setMinibarConsumption } from "@/lib/actions/minibar";
import type { MinibarItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { formatDateShortPt, dateKeyInBrazil } from "@/lib/date";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import type { PaymentMethod } from "@/lib/types";

// Quase sempre "Suíte N" — só some a "saída de hoje"/"chegada de hoje" (+
// nome, se a Stays informou) numa suíte com Saída com Chegada em
// andamento, quando a conta do hóspede que sai ainda não foi paga.
function roomSlotLabel(room: RoomBillOverview): string {
  if (room.guestSlot === "unica") return `Suíte ${room.room_number}`;
  const situacao = room.guestSlot === "saida_hoje" ? "saída de hoje" : "chegada de hoje";
  const name = room.guestNameHint ? ` (${room.guestNameHint})` : "";
  return `Suíte ${room.room_number} — ${situacao}${name}`;
}

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
        <RoomAccordionItem key={room.bill_id} room={room} minibarItems={minibarItems} />
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
  // Diálogo de confirmação de pagamento: a camareira só escolhe a forma de
  // pagamento (não digita valor — o total já é o calculado ao fechar a
  // conta; não há pagamento parcial nem estorno neste app).
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");

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

  // A taxa de serviço de 10% sobre o bar não é obrigatória por lei — o
  // hóspede pode recusar o pagamento dela ao fechar a conta. Isentar tira
  // o valor dos 10% desta conta específica e também da comissão de quem
  // lançou as comandas que a compõem (ver comandas.ts), sem afetar
  // nenhuma outra conta/comanda.
  function handleToggleServiceCharge(waived: boolean) {
    if (
      waived &&
      !confirm(
        "A taxa de serviço de 10% sobre o bar não é uma cobrança obrigatória por lei — use isso quando o hóspede não quiser pagá-la. As camareiras não recebem comissão sobre as comandas desta conta. Confirma a isenção?"
      )
    ) {
      return;
    }
    runAction(
      () => setServiceChargeWaived(room.room_id, waived, room.guestSlot),
      waived ? "Taxa de serviço isentada nesta conta." : "Taxa de serviço voltou a ser cobrada nesta conta."
    );
  }

  // Salva sempre base + o que está no stepper — por isso o consumo lançado
  // aqui soma ao que a camareira já tinha lançado durante o serviço na
  // suíte, em vez de sobrescrevê-lo.
  function handleAdditionalChange(itemId: string, v: number) {
    setAdditionalQty((prev) => ({ ...prev, [itemId]: v }));
    runAction(() => setMinibarConsumption(room.room_id, itemId, (baseQty[itemId] ?? 0) + v, room.guestSlot));
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
          minibarItems.map((item) => setMinibarConsumption(room.room_id, item.id, 0, room.guestSlot))
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

  function handleConfirmPayment() {
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    runAction(() => markRoomBillPaid(room.room_id, paymentMethod, room.guestSlot), "Pagamento registrado.");
    setPaymentDialogOpen(false);
    setPaymentMethod("");
  }

  const showEditableMinibar =
    room.status === "reaberta" || (room.status === "aberta" && isLaunchingAdditional);

  return (
    <AccordionItem value={room.bill_id}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-heading text-base">{roomSlotLabel(room)}</span>
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
                      htmlFor={`launch-additional-${room.bill_id}`}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Lançar consumo adicional
                    </Label>
                    <Switch
                      id={`launch-additional-${room.bill_id}`}
                      checked={isLaunchingAdditional}
                      disabled={isPending}
                      onCheckedChange={(checked) => handleStartLaunchingAdditional(!!checked)}
                    />
                  </div>
                )}
              </div>
              {room.departureFrigobarStatus === "confirmed_via_checklist" && (
                <p className="text-xs text-muted-foreground">
                  ✓ Consumo de frigobar do hóspede que saiu já foi conferido pela camareira no checklist.
                </p>
              )}
              {room.departureFrigobarStatus === "pending_needs_manual_entry" && (
                <p className="text-xs text-destructive">
                  Ainda não foi lançado o consumo de frigobar do hóspede que saiu — confira e lance aqui.
                </p>
              )}
              {room.status === "reaberta" && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Lançamento adicional de consumo</p>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`zero-relaunch-${room.bill_id}`}
                      checked={isIntegralMode}
                      disabled={isPending}
                      onCheckedChange={(checked) => handleToggleIntegralMode(!!checked)}
                    />
                    <Label
                      htmlFor={`zero-relaunch-${room.bill_id}`}
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
            <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
              <span>Taxa de serviço (10% sobre o bar){room.serviceChargeWaived && " · isenta"}</span>
              <span>R$ {room.serviceCharge.toFixed(2)}</span>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground"
                disabled={isPending}
                onClick={() => handleToggleServiceCharge(!room.serviceChargeWaived)}
              >
                {room.serviceChargeWaived ? "Cobrar taxa de serviço (10%)" : "Isentar taxa de serviço (10%)"}
              </Button>
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
            <Button
              size="sm"
              variant="outline"
              disabled={room.status !== "fechada" || isPending}
              onClick={() => router.push(`/bar-piscina/conta/${room.bill_id}`)}
            >
              Ver PDF da conta
            </Button>

            {room.status === "fechada" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button size="sm" disabled={isPending} onClick={() => setPaymentDialogOpen(true)}>
                  Pagamento efetuado
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => router.push(`/bar-piscina/pix/${room.bill_id}`)}
                >
                  Pagar com PIX
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => runAction(() => reopenRoomBill(room.room_id, room.guestSlot), "Conta reaberta.")}
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
                onClick={() => runAction(() => closeRoomBill(room.room_id, room.guestSlot), "Conta fechada.")}
              >
                Fechar a conta
              </Button>
            )}

            {room.lastPaidBill && (
              <p className="text-xs text-muted-foreground">
                Última conta paga: R$ {room.lastPaidBill.total.toFixed(2)} em{" "}
                {formatDateShortPt(dateKeyInBrazil(room.lastPaidBill.paid_at))}
                {room.lastPaidBill.payment_method &&
                  ` · ${PAYMENT_METHOD_LABELS[room.lastPaidBill.payment_method]}`}
              </p>
            )}
          </div>
        </div>
      </AccordionPanel>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento — Suíte {room.room_number}</DialogTitle>
            <DialogDescription>
              Valor total: R$ {room.grandTotal.toFixed(2)}. Selecione a forma de pagamento usada pelo hóspede.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Forma de pagamento</label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod((v as PaymentMethod) ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a forma de pagamento">
                  {(v: string) => PAYMENT_METHOD_LABELS[v as PaymentMethod] ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button disabled={isPending || !paymentMethod} onClick={handleConfirmPayment}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccordionItem>
  );
}

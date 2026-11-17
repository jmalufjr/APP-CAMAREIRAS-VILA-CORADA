"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoomBillOverview, RecentlyPaidBill } from "@/lib/actions/room-bills";
import { closeRoomBill, reopenRoomBill, markRoomBillPaid, setServiceChargeWaived, createWalkinBill } from "@/lib/actions/room-bills";
import { setMinibarConsumption } from "@/lib/actions/minibar";
import type { MinibarItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { formatDateTimePt, todayKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsumptionMatrixTable } from "@/components/shared/consumption-matrix-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHOD_LABELS, GUEST_PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import type { PaymentMethod } from "@/lib/types";
import { roomSlotLabel } from "@/lib/room-bill-label";

export function ConsumoQuartosPanel({
  overview,
  minibarItems,
  recentlyPaid,
  paidCard,
  isAdmin = false,
}: {
  overview: RoomBillOverview[];
  minibarItems: MinibarItem[];
  recentlyPaid: RecentlyPaidBill[];
  // Admin: no lugar do card simples de contas pagas, passa o card com PDF e reenvio de e-mail.
  paidCard?: React.ReactNode;
  // Admin: as colunas de serviço do frigobar abrem a tela do serviço.
  isAdmin?: boolean;
}) {
  const inHouse = overview.filter((r) => r.group === "in_house");
  const former = overview.filter((r) => r.group === "former");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <WalkinDialogButton />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hóspedes na pousada</CardTitle>
          <p className="text-xs text-muted-foreground">
            Contas abertas ou fechadas (ainda sem pagamento) de quem está hospedado, inclusive quem sai e quem chega hoje.
          </p>
        </CardHeader>
        <CardContent>
          {inHouse.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta de hóspede na pousada.</p>
          ) : (
            <Accordion className="space-y-2">
              {inHouse.map((room) => (
                <RoomAccordionItem key={room.bill_id} room={room} minibarItems={minibarItems} isAdmin={isAdmin} />
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hóspedes que já saíram</CardTitle>
          <p className="text-xs text-muted-foreground">
            Contas abertas ou fechadas que ainda não foram pagas, de hóspedes cujo check-out já passou.
          </p>
        </CardHeader>
        <CardContent>
          {former.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta pendente de hóspede que já saiu.</p>
          ) : (
            <Accordion className="space-y-2">
              {former.map((room) => (
                <RoomAccordionItem key={room.bill_id} room={room} minibarItems={minibarItems} isAdmin={isAdmin} />
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {paidCard ?? (
      <Card>
        <CardHeader>
          <CardTitle>Contas pagas nos últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {recentlyPaid.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta paga nos últimos 30 dias.</p>
          ) : (
            <div className="space-y-2">
              {recentlyPaid.map((bill) => (
                <div key={bill.bill_id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {roomSlotLabel(
                        { room_number: bill.room_number, guestNameHint: bill.guestNameHint, stayCheckIn: bill.stayCheckIn, stayCheckOut: bill.stayCheckOut, isWalkin: bill.isWalkin },
                        { withDates: true }
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paga em {formatDateTimePt(bill.paid_at)}
                      {bill.paymentMethod && ` · ${PAYMENT_METHOD_LABELS[bill.paymentMethod]}`}
                    </p>
                  </div>
                  <span className="shrink-0">R$ {bill.grandTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

// Conta avulsa: de ex-hóspede (já fez check-out) que quer consumir no bar — sem suíte, sem reserva, sem frigobar.
function WalkinDialogButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(todayKey());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    startTransition(async () => {
      const result = await createWalkinBill(name, phone, date);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta avulsa criada. Ela já aparece ao fazer um pedido de comanda.");
      setOpen(false);
      setName("");
      setPhone("");
      setDate(todayKey());
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Adicionar conta avulsa
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conta avulsa</DialogTitle>
            <DialogDescription>
              Para quem já fez check-out e quer consumir no bar. A conta é identificada pelo nome completo, telefone e data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-name">Nome completo</Label>
              <Input id="walkin-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-phone">Telefone</Label>
              <Input id="walkin-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-date">Data</Label>
              <Input id="walkin-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isPending || name.trim().length < 3 || phone.trim().length < 8} onClick={handleCreate}>
              Criar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoomAccordionItem({ room, minibarItems, isAdmin }: { room: RoomBillOverview; minibarItems: MinibarItem[]; isAdmin: boolean }) {
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
    // Aberta ou reaberta: a conta sempre volta ao mesmo aspecto, com o lançamento adicional fechado.
    setIsLaunchingAdditional(false);
    setBaseQty(initialMinibarQty);
    setAdditionalQty(zeroQty);
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
      () => setServiceChargeWaived(room.room_id, waived, room.bill_id),
      waived ? "Taxa de serviço isentada nesta conta." : "Taxa de serviço voltou a ser cobrada nesta conta."
    );
  }

  // Salva sempre base + o que está no stepper — por isso o consumo lançado
  // aqui soma ao que a camareira já tinha lançado durante o serviço na
  // suíte, em vez de sobrescrevê-lo.
  function handleAdditionalChange(itemId: string, v: number) {
    setAdditionalQty((prev) => ({ ...prev, [itemId]: v }));
    runAction(() => setMinibarConsumption(room.bill_id, itemId, (baseQty[itemId] ?? 0) + v));
  }

  function handleStartLaunchingAdditional(checked: boolean) {
    setIsLaunchingAdditional(checked);
    if (checked) {
      setBaseQty(initialMinibarQty);
      setAdditionalQty(zeroQty);
    }
  }

  function handleConfirmPayment() {
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    runAction(() => markRoomBillPaid(room.room_id, paymentMethod, room.bill_id), "Pagamento registrado.");
    setPaymentDialogOpen(false);
    setPaymentMethod("");
  }

  const showEditableMinibar = (room.status === "aberta" || room.status === "reaberta") && isLaunchingAdditional;

  return (
    <AccordionItem value={room.bill_id}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-heading text-base">{roomSlotLabel(room, { withDates: true })}</span>
          {room.status === "fechada" && <Badge variant="secondary">Conta fechada</Badge>}
        </span>
        <span className="text-xs text-muted-foreground mr-2">R$ {room.grandTotal.toFixed(2)}</span>
      </AccordionTrigger>
      <AccordionPanel>
        <div className="space-y-3 pt-3">
          {room.isWalkin && room.walkinPhone && (
            <p className="text-xs text-muted-foreground">Telefone: {room.walkinPhone}</p>
          )}
          <div className="grid gap-4">
            {!room.isWalkin && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Frigobar</p>
                {(room.status === "aberta" || room.status === "reaberta") && (
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
              <ConsumptionMatrixTable
                matrix={room.minibarMatrix}
                emptyText="Sem consumo de frigobar."
                serviceHref={isAdmin ? (taskId) => `/dashboard/tarefas/${taskId}` : undefined}
              />
              {showEditableMinibar && (
                <div className="space-y-1.5 pt-2">
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
              )}
            </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Bar da piscina <span className="font-normal">(via comandas)</span>
              </p>
              <ConsumptionMatrixTable matrix={room.barMatrix} emptyText="Nenhuma comanda ativa para esta suíte." />
            </div>
          </div>

          <div className="border-t border-border pt-2 space-y-1 text-sm max-w-md">
            {!room.isWalkin && (
              <div className="flex items-center justify-between">
                <span>Total frigobar</span>
                <span>R$ {room.minibarTotal.toFixed(2)}</span>
              </div>
            )}
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
              <span>{room.isWalkin ? "Total da conta" : "Total bar e frigobar"}</span>
              <span>R$ {room.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
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
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => router.push(`/bar-piscina/pix/${room.bill_id}`)}
                >
                  QR code - PIX
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => runAction(() => reopenRoomBill(room.room_id, room.bill_id), "Conta reaberta.")}
                >
                  Reabrir conta
                </Button>
              </div>
            )}

            {(room.status === "aberta" || room.status === "reaberta") && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => runAction(() => closeRoomBill(room.room_id, room.bill_id), "Conta fechada.")}
              >
                Fechar a conta
              </Button>
            )}

            {room.status === "fechada" && (
              <div className="flex justify-end pt-2">
                <Button size="sm" disabled={isPending} onClick={() => setPaymentDialogOpen(true)}>
                  A conta foi paga
                </Button>
              </div>
            )}

          </div>
        </div>
      </AccordionPanel>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento — {room.isWalkin ? `Avulsa — ${room.guestNameHint ?? ""}` : `Suíte ${room.room_number}`}</DialogTitle>
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
                {GUEST_PAYMENT_METHOD_OPTIONS.map((option) => (
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

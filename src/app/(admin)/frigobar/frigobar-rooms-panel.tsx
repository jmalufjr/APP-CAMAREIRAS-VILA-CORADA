"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoomBillOverview, RecentlyPaidBill } from "@/lib/actions/room-bills";
import { resendRoomBillReceipt, updateAccountingEmail } from "@/lib/actions/room-bills";
import type { ReceiptSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { formatDateShortPt, formatDateTimePt } from "@/lib/date";

// Somente leitura: fechar/reabrir/pagamento passaram a ser ações da
// camareira, na tela "Consumo por quartos" dela (ver Parte 05 do CLAUDE.md).
export function FrigobarRoomsPanel({
  overview,
  recentlyPaid,
  receiptSettings,
}: {
  overview: RoomBillOverview[];
  recentlyPaid: RecentlyPaidBill[];
  receiptSettings: ReceiptSettings;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium">Contas em aberto ou fechadas</p>
        {overview.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum quarto ativo cadastrado.</p>
        ) : (
          <Accordion className="space-y-2">
            {overview.map((room) => (
              <RoomAccordionItem key={room.room_id} room={room} />
            ))}
          </Accordion>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Contas pagas (últimos 7 dias)</p>
        {recentlyPaid.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta paga nos últimos 7 dias.</p>
        ) : (
          <Accordion className="space-y-2">
            {recentlyPaid.map((bill) => (
              <PaidBillAccordionItem key={bill.bill_id} bill={bill} />
            ))}
          </Accordion>
        )}
      </div>

      <AccountingEmailSettings receiptSettings={receiptSettings} />
    </div>
  );
}

function AccountingEmailSettings({ receiptSettings }: { receiptSettings: ReceiptSettings }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [email, setEmail] = useState(receiptSettings.accounting_email ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await updateAccountingEmail(email);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("E-mail atualizado.");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">E-mail da contabilidade</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Input
          type="email"
          className="w-full sm:w-72"
          placeholder="contabilidade@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
        />
        <Button disabled={isPending} onClick={handleSave}>
          Salvar
        </Button>
        <p className="text-xs text-muted-foreground basis-full">
          É pra este e-mail que o recibo em PDF de cada conta é enviado automaticamente assim que a camareira
          informa o pagamento.
        </p>
      </CardContent>
    </Card>
  );
}

function PaidBillAccordionItem({ bill }: { bill: RecentlyPaidBill }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleResend() {
    startTransition(async () => {
      const result = await resendRoomBillReceipt(bill.bill_id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("E-mail reenviado.");
        router.refresh();
      }
    });
  }

  return (
    <AccordionItem value={bill.bill_id}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-heading text-base">Quarto {bill.room_number}</span>
          <span className="text-xs text-muted-foreground">Paga em {formatDateTimePt(bill.paid_at)}</span>
          {!bill.receiptEmailSent && <Badge variant="destructive">E-mail não enviado</Badge>}
        </span>
        <span className="text-xs text-muted-foreground mr-2">R$ {bill.grandTotal.toFixed(2)}</span>
      </AccordionTrigger>
      <AccordionPanel>
        <div className="space-y-3 pt-3">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Frigobar</p>
              <div className="space-y-1.5">
                {bill.minibarItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span>
                      {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                    </span>
                    <span>R$ {item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                {bill.minibarItems.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Sem consumo.</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Bar da piscina</p>
              <div className="space-y-1.5">
                {bill.poolbarItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span>
                      {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                    </span>
                    <span>R$ {item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                {bill.poolbarItems.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Sem consumo.</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-2 space-y-1 text-sm max-w-md">
            <div className="flex items-center justify-between">
              <span>Total frigobar</span>
              <span>R$ {bill.minibarTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total bar da piscina</span>
              <span>R$ {bill.poolbarSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Taxa de serviço (10% sobre o bar)</span>
              <span>R$ {bill.serviceCharge.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Bar da piscina com taxa</span>
              <span>R$ {bill.poolbarTotalWithCharge.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-medium pt-1">
              <span>Total bar e frigobar</span>
              <span>R$ {bill.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {bill.paidByName && (
            <p className="text-xs text-muted-foreground">Pagamento informado por: {bill.paidByName}</p>
          )}

          {!bill.receiptEmailSent && (
            <p className="text-sm font-medium text-destructive">
              O envio automático do PDF por e-mail para a contabilidade não foi concluído.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              render={
                <a href={`/api/room-bills/${bill.bill_id}/receipt`} target="_blank" rel="noopener noreferrer" />
              }
              nativeButton={false}
            >
              Ver PDF
            </Button>
            {!bill.receiptEmailSent && (
              <Button size="sm" disabled={isPending} onClick={handleResend}>
                Reenviar e-mail
              </Button>
            )}
          </div>
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}

function RoomAccordionItem({ room }: { room: RoomBillOverview }) {
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
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Frigobar</p>
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
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Bar da piscina</p>
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
                  <p className="text-sm text-muted-foreground py-2">Sem consumo em aberto.</p>
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

          {room.lastPaidBill && (
            <p className="text-xs text-muted-foreground">
              Última conta paga: R$ {room.lastPaidBill.total.toFixed(2)} em{" "}
              {formatDateShortPt(room.lastPaidBill.paid_at.slice(0, 10))}
            </p>
          )}

          {room.closedByName && (
            <p className="text-xs text-muted-foreground">Fechada por: {room.closedByName}</p>
          )}
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}

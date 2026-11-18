"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RecentlyPaidBill } from "@/lib/actions/room-bills";
import { resendRoomBillReceipt, resurrectRoomBill } from "@/lib/actions/room-bills";
import { ConsumptionMatrixTable } from "@/components/shared/consumption-matrix-table";
import { ReactivationNotes } from "@/components/shared/reactivation-notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { formatDateTimePt } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-method";
import { roomSlotLabel } from "@/lib/room-bill-label";

// Somente leitura: fechar/reabrir/pagamento passaram a ser ações da
// camareira, na tela "Consumo por quartos" dela (ver Parte 05 do CLAUDE.md).
// O card de e-mail (antes "E-mail da contabilidade") saiu daqui e virou a
// tela "Cadastrar e-mail de envio" no menu do Resumo Executivo (Parte 34).
// Card de contas pagas (com PDF e reenvio do e-mail) — usado em Consumo por suítes e no Histórico.
export function PaidBillsCard({ bills, title, emptyText, isAdmin = false }: { bills: RecentlyPaidBill[]; title: string; emptyText: string; isAdmin?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
        ) : (
          <Accordion className="space-y-2">
            {bills.map((bill) => (
              <PaidBillAccordionItem key={bill.bill_id} bill={bill} isAdmin={isAdmin} />
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function PaidBillAccordionItem({ bill, isAdmin }: { bill: RecentlyPaidBill; isAdmin: boolean }) {
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

  function handleResurrect() {
    if (
      !confirm(
        "Reabrir esta conta? Ela volta para as contas abertas com todo o consumo lançado, e o registro de que foi fechada e paga é apagado (fica só uma observação no rodapé)."
      )
    )
      return;
    startTransition(async () => {
      const result = await resurrectRoomBill(bill.bill_id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Conta reaberta: ela voltou para as contas abertas.");
        router.refresh();
      }
    });
  }

  return (
    <AccordionItem value={bill.bill_id}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-heading text-base">
            {roomSlotLabel(
              { room_number: bill.room_number, guestNameHint: bill.guestNameHint, stayCheckIn: bill.stayCheckIn, stayCheckOut: bill.stayCheckOut, isWalkin: bill.isWalkin },
              { withDates: true }
            )}
          </span>
          <span className="text-xs text-muted-foreground">Paga em {formatDateTimePt(bill.paid_at)}</span>
          {!bill.receiptEmailSent && <Badge variant="destructive">E-mail não enviado</Badge>}
        </span>
        <span className="text-xs text-muted-foreground mr-2">R$ {bill.grandTotal.toFixed(2)}</span>
      </AccordionTrigger>
      <AccordionPanel>
        <div className="space-y-3 pt-3">
          {bill.barMatrix ? (
            <div className="grid gap-4">
              {!bill.isWalkin && bill.minibarMatrix && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Frigobar</p>
                  <ConsumptionMatrixTable matrix={bill.minibarMatrix} emptyText="Sem consumo de frigobar." serviceHref={(taskId) => `/dashboard/tarefas/${taskId}`} />
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Bar da piscina <span className="font-normal">(via comandas)</span>
                </p>
                <ConsumptionMatrixTable matrix={bill.barMatrix} emptyText="Nenhuma comanda nesta conta." />
              </div>
            </div>
          ) : (
          <div className={bill.isWalkin ? "grid gap-4" : "grid sm:grid-cols-2 gap-x-8 gap-y-4"}>
            {!bill.isWalkin && (
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
            )}
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
          )}

          <div className="border-t border-border pt-2 space-y-1 text-sm max-w-md">
            {!bill.isWalkin && (
              <div className="flex items-center justify-between">
                <span>Total frigobar</span>
                <span>R$ {bill.minibarTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Total bar da piscina</span>
              <span>R$ {bill.poolbarSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Taxa de serviço (10% sobre o bar){bill.serviceChargeWaived && " · isenta"}</span>
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
          {bill.paymentMethod && (
            <p className="text-xs text-muted-foreground">
              Forma de pagamento: {PAYMENT_METHOD_LABELS[bill.paymentMethod]}
            </p>
          )}

          {!bill.receiptEmailSent && (
            <p className="text-sm font-medium text-destructive">
              O envio automático do PDF por e-mail para a contabilidade não foi concluído.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push(`/frigobar/conta/${bill.bill_id}`)}>
              Ver PDF
            </Button>
            {!bill.receiptEmailSent && (
              <Button size="sm" disabled={isPending} onClick={handleResend}>
                Reenviar e-mail
              </Button>
            )}
            {isAdmin && bill.canResurrect && (
              <Button size="sm" variant="outline" disabled={isPending} onClick={handleResurrect}>
                Reabrir conta (paga por engano)
              </Button>
            )}
          </div>

          <ReactivationNotes log={bill.reactivationLog} />
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  computeBillTotals,
  type RoomBillLineItem,
  type MinibarRow,
  type PoolbarRow,
} from "@/lib/room-bills";
import { renderReceiptPdf, type ReceiptData } from "@/lib/receipt-pdf";
import type { RoomBillStatus, ReceiptSettings, PaymentMethod } from "@/lib/types";
import { startOfDayBrasiliaUtc, nextDayBrasiliaUtcBoundary, todayKey } from "@/lib/date";
import { Resend } from "resend";

// Fechar/reabrir/marcar como paga a conta do quarto: ação da camareira (a
// tela "Consumo por quartos" do admin passou a ser só leitura). As funções
// SQL security definer (close_room_bill/reopen_room_bill/pay_room_bill)
// checam is_camareira() e fazem toda a transição em 1 round trip.

export async function closeRoomBill(roomId: string, billId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_room_bill", { p_room_id: roomId, p_bill_id: billId });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/comanda");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function reopenRoomBill(roomId: string, billId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_room_bill", { p_room_id: roomId, p_bill_id: billId });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/comanda");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function markRoomBillPaid(roomId: string, paymentMethod: PaymentMethod, billIdToPay: string) {
  const supabase = await createClient();
  const { data: billId, error } = await supabase.rpc("pay_room_bill", {
    p_room_id: roomId,
    p_payment_method: paymentMethod,
    p_bill_id: billIdToPay,
  });
  if (error) return { error: error.message };

  // Envio do recibo por e-mail é "melhor esforço": a camareira já vê o
  // pagamento confirmado independente disso; se falhar, fica só registrado
  // (receipt_email_sent = false) pro admin ver e reenviar depois.
  if (billId) {
    const sent = await sendReceiptEmail(billId as string);
    await supabase.rpc("mark_receipt_email_sent", { p_bill_id: billId, p_sent: sent });
  }

  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/comanda");
  revalidatePath("/tarefas");
  return { success: true };
}

// Reenvio manual pelo admin (aba "Consumo por quartos", contas pagas dos
// últimos 7 dias) quando o envio automático falhou.
export async function resendRoomBillReceipt(billId: string) {
  const supabase = await createClient();
  const sent = await sendReceiptEmail(billId);
  const { error } = await supabase.rpc("mark_receipt_email_sent", { p_bill_id: billId, p_sent: sent });
  if (error) return { error: error.message };
  if (!sent) return { error: "Falha ao enviar o e-mail. Tente novamente." };
  revalidatePath("/frigobar");
  return { success: true };
}

// Isenta (ou volta a cobrar) a taxa de serviço de 10% sobre o bar da
// conta corrente do quarto — a taxa não é uma cobrança obrigatória por
// lei, e o hóspede pode recusar o pagamento dela. Isentar tira dessa
// conta específica o valor dos 10%, e nenhuma comanda que a compõe conta
// mais na comissão de quem a lançou (ver getBarCommissionByCamareira* em
// comandas.ts) — nenhuma outra conta ou comanda é afetada.
export async function setServiceChargeWaived(roomId: string, waived: boolean, billId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_room_bill_service_charge_waived", {
    p_room_id: roomId,
    p_waived: waived,
    p_bill_id: billId,
  });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
  return { success: true };
}

// ---------- Leitura combinada para a tela do admin "Consumo de Bar e Frigobar" ----------

export interface RoomBillOverview {
  room_id: string;
  room_number: string;
  bill_id: string;
  status: RoomBillStatus;
  // Nome do hóspede da reserva (Stays) e datas da estadia — a conta é sempre
  // identificada por (suíte, hóspede, reserva); a reserva em si fica escondida.
  guestNameHint: string | null;
  stayCheckIn: string | null;
  stayCheckOut: string | null;
  // "in_house" = hóspede ainda na pousada (check-out hoje ou depois, inclui quem
  // chega e quem sai hoje); "former" = já saiu e ainda não pagou (ou sem datas).
  group: "in_house" | "former";
  minibarItems: RoomBillLineItem[];
  minibarTotal: number;
  poolbarItems: RoomBillLineItem[];
  poolbarSubtotal: number;
  serviceCharge: number;
  poolbarTotalWithCharge: number;
  grandTotal: number;
  // Se o hóspede recusou o pagamento da taxa de serviço de 10% nesta
  // conta específica (a taxa não é obrigatória por lei) — quando true,
  // serviceCharge/poolbarTotalWithCharge/grandTotal já vêm calculados
  // sem ela.
  serviceChargeWaived: boolean;
  // Nome da camareira que fechou a conta corrente (null se ela nunca foi
  // fechada ainda — só existe uma vez que closed_by é gravado).
  closedByName: string | null;
}

// Contas não pagas (abertas, fechadas ou reabertas), uma por hóspede/reserva, já separadas em
// "hóspedes que ainda estão na pousada" e "hóspedes que já saíram e ainda não pagaram".
export async function getRoomBillsOverview(): Promise<RoomBillOverview[]> {
  const supabase = await createClient();
  const today = todayKey();
  const [{ data: rooms }, { data: bills }] = await Promise.all([
    supabase.from("rooms").select("id, number, position").eq("active", true).order("position"),
    supabase
      .from("room_bills")
      .select("*, closed_by_profile:profiles!room_bills_closed_by_fkey(name)")
      .neq("status", "paga"),
  ]);

  type BillRow = {
    room_id: string;
    id: string;
    status: RoomBillStatus;
    guest_name_hint: string | null;
    stay_check_in: string | null;
    stay_check_out: string | null;
    service_charge_waived: boolean;
    closed_by_profile: { name: string } | null;
  };

  const roomList = rooms ?? [];
  const roomOrder = new Map(roomList.map((r, i) => [r.id as string, i]));
  const allBills = ((bills ?? []) as unknown as BillRow[]).filter((b) => roomOrder.has(b.room_id));
  const billIds = allBills.map((b) => b.id);

  const [{ data: minibarRows }, { data: poolbarRows }] = await Promise.all([
    billIds.length
      ? supabase
          .from("room_bill_minibar_items")
          .select("bill_id, minibar_item_id, quantity, price_snapshot, minibar_items(name)")
          .in("bill_id", billIds)
          .gt("quantity", 0)
      : Promise.resolve({ data: [] as unknown[] }),
    // Bar da piscina vem das comandas ativas (não canceladas) daquele bill_id.
    billIds.length
      ? supabase
          .from("bar_comanda_items")
          .select("quantity, price_snapshot, poolbar_item_id, poolbar_items(name), bar_comandas!inner(bill_id, status)")
          .in("bar_comandas.bill_id", billIds)
          .neq("bar_comandas.status", "cancelada")
          .gt("quantity", 0)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const mbRows = (minibarRows ?? []) as unknown as MinibarRow[];
  const pbRows = (poolbarRows ?? []) as unknown as PoolbarRow[];
  const roomNumber = new Map(roomList.map((r) => [r.id as string, r.number as string]));

  return allBills
    .map((bill) => {
      const totals = computeBillTotals(bill.id, mbRows, pbRows, bill.service_charge_waived);
      const inHouse = !!bill.stay_check_out && bill.stay_check_out >= today;
      return {
        room_id: bill.room_id,
        room_number: roomNumber.get(bill.room_id) ?? "—",
        bill_id: bill.id,
        status: bill.status,
        guestNameHint: bill.guest_name_hint,
        stayCheckIn: bill.stay_check_in,
        stayCheckOut: bill.stay_check_out,
        group: inHouse ? ("in_house" as const) : ("former" as const),
        ...totals,
        closedByName: bill.closed_by_profile?.name ?? null,
      };
    })
    .sort(
      (x, y) =>
        (roomOrder.get(x.room_id) ?? 0) - (roomOrder.get(y.room_id) ?? 0) ||
        (x.stayCheckIn ?? "").localeCompare(y.stayCheckIn ?? "")
    );
}

// ---------- Recibo em PDF de uma conta paga (visualização e e-mail) ----------

// Busca os dados de UMA conta específica, no mesmo formato usado pelo PDF —
// reaproveitado para o recibo de pagamento (link "Ver PDF" do admin e
// anexo do e-mail) e para o PDF da conta fechada, ainda não paga, que a
// camareira pode ver antes do pagamento. O texto/data do subtítulo do PDF
// muda conforme o status atual da conta; qualquer outro status (aberta/
// reaberta) não tem PDF — devolve null.
export async function getRoomBillReceiptData(billId: string): Promise<ReceiptData | null> {
  const supabase = await createClient();
  const { data: bill } = await supabase
    .from("room_bills")
    .select("status, paid_at, closed_at, service_charge_waived, rooms(number)")
    .eq("id", billId)
    .single();
  if (!bill) return null;

  let statusLabel: string;
  let statusDate: string;
  if (bill.status === "paga" && bill.paid_at) {
    statusLabel = "Pagamento registrado em";
    statusDate = bill.paid_at;
  } else if (bill.status === "fechada" && bill.closed_at) {
    statusLabel = "Conta fechada em (aguardando pagamento)";
    statusDate = bill.closed_at;
  } else {
    return null;
  }

  const [{ data: minibarRows }, { data: poolbarRows }] = await Promise.all([
    supabase
      .from("room_bill_minibar_items")
      .select("bill_id, minibar_item_id, quantity, price_snapshot, minibar_items(name)")
      .eq("bill_id", billId)
      .gt("quantity", 0),
    supabase
      .from("bar_comanda_items")
      .select("quantity, price_snapshot, poolbar_item_id, poolbar_items(name), bar_comandas!inner(bill_id, status)")
      .eq("bar_comandas.bill_id", billId)
      .neq("bar_comandas.status", "cancelada")
      .gt("quantity", 0),
  ]);

  const mbRows = (minibarRows ?? []) as unknown as MinibarRow[];
  const pbRows = (poolbarRows ?? []) as unknown as PoolbarRow[];
  const room = bill as unknown as { rooms: { number: string } | null };

  return {
    room_number: room.rooms?.number ?? "—",
    statusLabel,
    statusDate,
    ...computeBillTotals(billId, mbRows, pbRows, bill.service_charge_waived),
  };
}

// Confirma que uma conta está com status 'fechada' agora e devolve o número
// da suíte — usado pela tela da camareira que mostra o PDF da conta fechada
// antes do pagamento (guarda a página contra abrir para uma conta que já
// foi paga/reaberta desde então, não só desabilitar o botão na UI).
export async function getClosedBillRoomNumber(billId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: bill } = await supabase
    .from("room_bills")
    .select("status, rooms(number)")
    .eq("id", billId)
    .eq("status", "fechada")
    .single();
  if (!bill) return null;
  const room = bill as unknown as { rooms: { number: string } | null };
  return room.rooms?.number ?? "—";
}

// Mesma ideia de getClosedBillRoomNumber, mas para o PDF do recibo de uma
// conta já paga (tela do admin) — guarda a página contra abrir para uma
// conta que não está (ou não está mais) paga.
export async function getPaidBillRoomNumber(billId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: bill } = await supabase
    .from("room_bills")
    .select("status, rooms(number)")
    .eq("id", billId)
    .eq("status", "paga")
    .single();
  if (!bill) return null;
  const room = bill as unknown as { rooms: { number: string } | null };
  return room.rooms?.number ?? "—";
}

// ---------- Retrato do consumo de uma suíte numa data específica ----------

export interface RoomBillSnapshot {
  found: boolean;
  status: RoomBillStatus | null;
  minibarItems: RoomBillLineItem[];
  minibarTotal: number;
  poolbarItems: RoomBillLineItem[];
  poolbarSubtotal: number;
  serviceCharge: number;
  poolbarTotalWithCharge: number;
  grandTotal: number;
  serviceChargeWaived: boolean;
}

// Busca a conta do quarto vigente numa data específica (a tarefa/dia sendo
// visualizada pelo admin em /dashboard/tarefas/[taskId]) — a conta cujo
// ciclo (opened_at até paid_at, ou ainda em aberto) contém essa data.
// Importante: como o consumo não é registrado por dia (é acumulado por
// conta corrente do quarto, ver Parte 04 do CLAUDE.md), o valor devolvido é
// o total acumulado da conta inteira até aquele ponto, não só o que foi
// lançado especificamente nesse dia — a UI precisa rotular isso com
// clareza, não como "consumo daquele dia".
export async function getRoomBillSnapshotForDate(roomId: string, dateKey: string): Promise<RoomBillSnapshot> {
  const supabase = await createClient();
  const { data: bill } = await supabase
    .from("room_bills")
    .select("id, status, opened_at, paid_at, service_charge_waived")
    .eq("room_id", roomId)
    // opened_at/paid_at são instantes reais (timestamptz) — comparar
    // contra strings ingênuas tipo `${dateKey}T23:59:59` erraria por até
    // 3h, já que Brasília é UTC-3 (ver
    // startOfDayBrasiliaUtc/nextDayBrasiliaUtcBoundary).
    .lt("opened_at", nextDayBrasiliaUtcBoundary(dateKey))
    .or(`paid_at.is.null,paid_at.gte.${startOfDayBrasiliaUtc(dateKey)}`)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const empty: RoomBillSnapshot = {
    found: false,
    status: null,
    minibarItems: [],
    minibarTotal: 0,
    poolbarItems: [],
    poolbarSubtotal: 0,
    serviceCharge: 0,
    poolbarTotalWithCharge: 0,
    grandTotal: 0,
    serviceChargeWaived: false,
  };
  if (!bill) return empty;

  const [{ data: minibarRows }, { data: poolbarRows }] = await Promise.all([
    supabase
      .from("room_bill_minibar_items")
      .select("bill_id, minibar_item_id, quantity, price_snapshot, minibar_items(name)")
      .eq("bill_id", bill.id)
      .gt("quantity", 0),
    supabase
      .from("bar_comanda_items")
      .select("quantity, price_snapshot, poolbar_item_id, poolbar_items(name), bar_comandas!inner(bill_id, status)")
      .eq("bar_comandas.bill_id", bill.id)
      .neq("bar_comandas.status", "cancelada")
      .gt("quantity", 0),
  ]);

  const mbRows = (minibarRows ?? []) as unknown as MinibarRow[];
  const pbRows = (poolbarRows ?? []) as unknown as PoolbarRow[];

  return {
    found: true,
    status: bill.status,
    ...computeBillTotals(bill.id, mbRows, pbRows, bill.service_charge_waived),
  };
}

// ---------- Configuração: e-mail da contabilidade (destino do recibo) ----------
// Configurável pelo admin na tela "Consumo por quartos" (em vez de fixo por
// variável de ambiente) — mesmo padrão de singleton já usado em
// commission_settings.

export async function getReceiptSettings(): Promise<ReceiptSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("receipt_settings").select("*").eq("id", 1).single();
  return (data as ReceiptSettings) ?? { id: 1, accounting_email: null, updated_at: new Date().toISOString() };
}

export async function updateAccountingEmail(email: string) {
  const trimmed = email.trim();
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: "Informe um e-mail válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("receipt_settings")
    .update({ accounting_email: trimmed || null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/integracao/email-envio");
  return { success: true };
}

// Monta o PDF (a partir dos mesmos dados usados pela visualização) e manda
// pro e-mail cadastrado em receipt_settings — usado tanto pelo envio
// automático/reenvio (sendReceiptEmail, "melhor esforço", boolean) quanto
// pelo botão explícito "Enviar por e-mail" das telas de visualização do PDF
// (sendRoomBillPdfEmail, abaixo, que devolve o motivo da falha pra UI
// mostrar). Funciona tanto para conta paga quanto para conta fechada ainda
// não paga — o assunto do e-mail muda conforme statusLabel.
async function buildAndSendReceiptPdf(billId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const data = await getRoomBillReceiptData(billId);
  if (!data) return { ok: false, reason: "Conta não encontrada, ou ainda não fechada." };

  const { accounting_email: accountingEmail } = await getReceiptSettings();
  if (!accountingEmail) {
    return {
      ok: false,
      reason: "Nenhum e-mail de destino cadastrado. Peça para o admin cadastrar em 'E-mail de envio'.",
    };
  }

  try {
    const pdfBuffer = await renderReceiptPdf(data);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = data.statusLabel.startsWith("Pagamento")
      ? `Conta paga — Suíte ${data.room_number}`
      : `Conta fechada, aguardando pagamento — Suíte ${data.room_number}`;
    const { error } = await resend.emails.send({
      from: process.env.RECEIPT_FROM_EMAIL ?? "Vila Corada <recibos@consumos.vilacorada.com.br>",
      to: accountingEmail,
      subject,
      text: `Segue em anexo o PDF da conta da suíte ${data.room_number}.`,
      attachments: [{ filename: `conta-suite-${data.room_number}.pdf`, content: pdfBuffer }],
    });
    if (error) return { ok: false, reason: "Falha ao enviar o e-mail. Tente novamente." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Falha ao enviar o e-mail. Tente novamente." };
  }
}

// "Melhor esforço": nunca lança — quem chama trata o retorno (true/false)
// e grava o resultado via mark_receipt_email_sent, sem travar o fluxo de
// pagamento por causa de um problema de rede/credencial do provedor de e-mail.
async function sendReceiptEmail(billId: string): Promise<boolean> {
  const result = await buildAndSendReceiptPdf(billId);
  return result.ok;
}

// Envio explícito sob demanda, acionado pelo botão "Enviar por e-mail" nas
// telas de visualização do PDF (tanto a da camareira, conta fechada ainda
// não paga, quanto a do admin, conta paga) — diferente do envio automático
// no pagamento, aqui o resultado real é sempre mostrado (toast), nunca
// silencioso. Mesma checagem de papel da rota /api/room-bills/[billId]/conta
// (camareira ou admin), já que serve as duas telas.
export async function sendRoomBillPdfEmail(billId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "camareira" && profile?.role !== "admin") {
    return { error: "Não autorizado." };
  }

  const result = await buildAndSendReceiptPdf(billId);
  if (!result.ok) return { error: result.reason };

  // Se a conta já está paga, isso também conta como o recibo ter sido
  // enviado — limpa o badge "E-mail não enviado" da lista do admin, se
  // esse era o caso. Sem efeito relevante para uma conta ainda não paga
  // (a coluna é só usada/exibida no contexto de conta paga).
  const { data: bill } = await supabase.from("room_bills").select("status").eq("id", billId).single();
  if (bill?.status === "paga") {
    await supabase.rpc("mark_receipt_email_sent", { p_bill_id: billId, p_sent: true });
    revalidatePath("/frigobar");
  }

  return { success: true };
}

// ---------- Leitura: contas pagas recentemente (rodapé de "Consumo por quartos" do admin) ----------

export interface RecentlyPaidBill {
  bill_id: string;
  room_id: string;
  room_number: string;
  guestNameHint: string | null;
  stayCheckIn: string | null;
  stayCheckOut: string | null;
  paid_at: string;
  paidByName: string | null;
  paymentMethod: PaymentMethod | null;
  receiptEmailSent: boolean;
  minibarItems: RoomBillLineItem[];
  minibarTotal: number;
  poolbarItems: RoomBillLineItem[];
  poolbarSubtotal: number;
  serviceCharge: number;
  poolbarTotalWithCharge: number;
  grandTotal: number;
  serviceChargeWaived: boolean;
}

// Contas pagas nos últimos `days` dias (uma linha por conta paga, não só a
// mais recente de cada quarto — pode haver mais de uma conta paga do mesmo
// quarto na janela de 7 dias).
export async function getRecentlyPaidRoomBills(days = 7): Promise<RecentlyPaidBill[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: bills } = await supabase
    .from("room_bills")
    .select(
      "id, room_id, paid_at, payment_method, receipt_email_sent, service_charge_waived, guest_name_hint, stay_check_in, stay_check_out, rooms(number), paid_by_profile:profiles!room_bills_paid_by_fkey(name)"
    )
    .eq("status", "paga")
    .gte("paid_at", cutoff)
    .order("paid_at", { ascending: false });

  type PaidBillRow = {
    id: string;
    room_id: string;
    paid_at: string;
    payment_method: PaymentMethod | null;
    receipt_email_sent: boolean;
    service_charge_waived: boolean;
    guest_name_hint: string | null;
    stay_check_in: string | null;
    stay_check_out: string | null;
    rooms: { number: string } | null;
    paid_by_profile: { name: string } | null;
  };
  const billList = (bills ?? []) as unknown as PaidBillRow[];
  if (billList.length === 0) return [];

  const billIds = billList.map((b) => b.id);

  const [{ data: minibarRows }, { data: poolbarRows }] = await Promise.all([
    supabase
      .from("room_bill_minibar_items")
      .select("bill_id, minibar_item_id, quantity, price_snapshot, minibar_items(name)")
      .in("bill_id", billIds)
      .gt("quantity", 0),
    supabase
      .from("bar_comanda_items")
      .select("quantity, price_snapshot, poolbar_item_id, poolbar_items(name), bar_comandas!inner(bill_id, status)")
      .in("bar_comandas.bill_id", billIds)
      .neq("bar_comandas.status", "cancelada")
      .gt("quantity", 0),
  ]);

  const mbRows = (minibarRows ?? []) as unknown as MinibarRow[];
  const pbRows = (poolbarRows ?? []) as unknown as PoolbarRow[];

  return billList.map((bill) => ({
    bill_id: bill.id,
    room_id: bill.room_id,
    room_number: bill.rooms?.number ?? "—",
    guestNameHint: bill.guest_name_hint,
    stayCheckIn: bill.stay_check_in,
    stayCheckOut: bill.stay_check_out,
    paid_at: bill.paid_at,
    paidByName: bill.paid_by_profile?.name ?? null,
    paymentMethod: bill.payment_method,
    receiptEmailSent: bill.receipt_email_sent,
    ...computeBillTotals(bill.id, mbRows, pbRows, bill.service_charge_waived),
  }));
}

export interface ReceiptsByPaymentMethodRow {
  payment_method: PaymentMethod | null;
  total: number;
  count: number;
}

// Recebimentos de checkout por forma de pagamento, num período
// arbitrário (PRD_compras&contabil.md seção 22.1 item 8.2, Módulo
// Contábil Leva 7) — mesma lógica de totais de `getRecentlyPaidRoomBills`
// (reconstruída a partir das linhas de frigobar/comanda, nunca um total
// persistido), só que filtrada por `paid_at` num intervalo flexível em
// vez de "últimos N dias", e já agregada por forma de pagamento.
export async function getReceiptsByPaymentMethodForPeriod(from: string, to: string): Promise<ReceiptsByPaymentMethodRow[]> {
  const supabase = await createClient();
  const { data: bills } = await supabase
    .from("room_bills")
    .select("id, payment_method, service_charge_waived")
    .eq("status", "paga")
    .gte("paid_at", startOfDayBrasiliaUtc(from))
    .lt("paid_at", nextDayBrasiliaUtcBoundary(to));

  type PaidBillRow = { id: string; payment_method: PaymentMethod | null; service_charge_waived: boolean };
  const billList = (bills ?? []) as unknown as PaidBillRow[];
  if (billList.length === 0) return [];

  const billIds = billList.map((b) => b.id);
  const [{ data: minibarRows }, { data: poolbarRows }] = await Promise.all([
    supabase
      .from("room_bill_minibar_items")
      .select("bill_id, minibar_item_id, quantity, price_snapshot, minibar_items(name)")
      .in("bill_id", billIds)
      .gt("quantity", 0),
    supabase
      .from("bar_comanda_items")
      .select("quantity, price_snapshot, poolbar_item_id, poolbar_items(name), bar_comandas!inner(bill_id, status)")
      .in("bar_comandas.bill_id", billIds)
      .neq("bar_comandas.status", "cancelada")
      .gt("quantity", 0),
  ]);
  const mbRows = (minibarRows ?? []) as unknown as MinibarRow[];
  const pbRows = (poolbarRows ?? []) as unknown as PoolbarRow[];

  const byMethod = new Map<string, ReceiptsByPaymentMethodRow>();
  billList.forEach((bill) => {
    const key = bill.payment_method ?? "—";
    const { grandTotal } = computeBillTotals(bill.id, mbRows, pbRows, bill.service_charge_waived);
    const entry = byMethod.get(key) ?? { payment_method: bill.payment_method, total: 0, count: 0 };
    entry.total += grandTotal;
    entry.count += 1;
    byMethod.set(key, entry);
  });
  return Array.from(byMethod.values()).sort((a, b) => b.total - a.total);
}

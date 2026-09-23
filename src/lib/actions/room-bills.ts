"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getOrCreateCurrentBill, SERVICE_CHARGE_RATE } from "@/lib/room-bills";
import { renderReceiptPdf, type ReceiptData } from "@/lib/receipt-pdf";
import type { RoomBillStatus, ReceiptSettings } from "@/lib/types";
import { startOfDayBrasiliaUtc, nextDayBrasiliaUtcBoundary } from "@/lib/date";
import { Resend } from "resend";

// Fechar/reabrir/marcar como paga a conta do quarto: ação da camareira (a
// tela "Consumo por quartos" do admin passou a ser só leitura). As funções
// SQL security definer (close_room_bill/reopen_room_bill/pay_room_bill)
// checam is_camareira() e fazem toda a transição em 1 round trip.

export async function closeRoomBill(roomId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_room_bill", { p_room_id: roomId });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/comanda");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function reopenRoomBill(roomId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_room_bill", { p_room_id: roomId });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/comanda");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function markRoomBillPaid(roomId: string) {
  const supabase = await createClient();
  const { data: billId, error } = await supabase.rpc("pay_room_bill", { p_room_id: roomId });
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
export async function setServiceChargeWaived(roomId: string, waived: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_room_bill_service_charge_waived", {
    p_room_id: roomId,
    p_waived: waived,
  });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
  return { success: true };
}

// ---------- Leitura combinada para a tela do admin "Consumo de Bar e Frigobar" ----------

export interface RoomBillLineItem {
  id: string;
  name: string;
  quantity: number;
  subtotal: number;
}

export interface RoomBillOverview {
  room_id: string;
  room_number: string;
  bill_id: string;
  status: RoomBillStatus;
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
  lastPaidBill: { total: number; paid_at: string } | null;
}

function sumLines(rows: { id: string; name: string; quantity: number; price_snapshot: number }[]): RoomBillLineItem[] {
  const byId = new Map<string, RoomBillLineItem>();
  rows.forEach((r) => {
    const entry = byId.get(r.id) ?? { id: r.id, name: r.name, quantity: 0, subtotal: 0 };
    entry.quantity += r.quantity;
    entry.subtotal += r.quantity * Number(r.price_snapshot);
    byId.set(r.id, entry);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

type MinibarRow = {
  bill_id: string;
  minibar_item_id: string;
  quantity: number;
  price_snapshot: number;
  minibar_items: { name: string } | null;
};
type PoolbarRow = {
  quantity: number;
  price_snapshot: number;
  poolbar_item_id: string;
  poolbar_items: { name: string } | null;
  bar_comandas: { bill_id: string; status: string };
};

function computeBillTotals(billId: string, mbRows: MinibarRow[], pbRows: PoolbarRow[], waived: boolean) {
  const minibarItems = sumLines(
    mbRows
      .filter((r) => r.bill_id === billId)
      .map((r) => ({ id: r.minibar_item_id, name: r.minibar_items?.name ?? "—", quantity: r.quantity, price_snapshot: r.price_snapshot }))
  );
  const poolbarItems = sumLines(
    pbRows
      .filter((r) => r.bar_comandas.bill_id === billId)
      .map((r) => ({ id: r.poolbar_item_id, name: r.poolbar_items?.name ?? "—", quantity: r.quantity, price_snapshot: r.price_snapshot }))
  );
  const minibarTotal = minibarItems.reduce((sum, i) => sum + i.subtotal, 0);
  const poolbarSubtotal = poolbarItems.reduce((sum, i) => sum + i.subtotal, 0);
  const serviceCharge = waived ? 0 : poolbarSubtotal * SERVICE_CHARGE_RATE;
  const poolbarTotalWithCharge = poolbarSubtotal + serviceCharge;
  const grandTotal = minibarTotal + poolbarTotalWithCharge;
  return {
    minibarItems,
    minibarTotal,
    poolbarItems,
    poolbarSubtotal,
    serviceCharge,
    poolbarTotalWithCharge,
    grandTotal,
    serviceChargeWaived: waived,
  };
}

export async function getRoomBillsOverview(): Promise<RoomBillOverview[]> {
  const supabase = await createClient();
  const [{ data: rooms }, { data: bills }] = await Promise.all([
    supabase.from("rooms").select("id, number").eq("active", true).order("position"),
    supabase.from("room_bills").select("*, closed_by_profile:profiles!room_bills_closed_by_fkey(name)"),
  ]);

  type BillRow = {
    room_id: string;
    id: string;
    status: RoomBillStatus;
    paid_at: string | null;
    service_charge_waived: boolean;
    closed_by_profile: { name: string } | null;
  };

  const roomList = rooms ?? [];
  const allBills = (bills ?? []) as unknown as BillRow[];

  const currentBillByRoom = new Map<
    string,
    { id: string; status: RoomBillStatus; serviceChargeWaived: boolean; closedByName: string | null }
  >();
  for (const room of roomList) {
    const current = allBills.find((b) => b.room_id === room.id && b.status !== "paga");
    if (current) {
      currentBillByRoom.set(room.id, {
        id: current.id,
        status: current.status,
        serviceChargeWaived: current.service_charge_waived,
        closedByName: current.closed_by_profile?.name ?? null,
      });
    } else {
      const created = await getOrCreateCurrentBill(supabase, room.id);
      currentBillByRoom.set(room.id, {
        id: created.id,
        status: created.status,
        serviceChargeWaived: created.service_charge_waived,
        closedByName: null,
      });
    }
  }

  const currentBillIds = Array.from(currentBillByRoom.values()).map((b) => b.id);

  const lastPaidByRoom = new Map<string, { id: string; paid_at: string; serviceChargeWaived: boolean }>();
  allBills
    .filter((b) => b.status === "paga" && b.paid_at)
    .forEach((b) => {
      const existing = lastPaidByRoom.get(b.room_id);
      if (!existing || (b.paid_at as string) > existing.paid_at) {
        lastPaidByRoom.set(b.room_id, {
          id: b.id,
          paid_at: b.paid_at as string,
          serviceChargeWaived: b.service_charge_waived,
        });
      }
    });
  const lastPaidBillIds = Array.from(lastPaidByRoom.values()).map((b) => b.id);

  const allRelevantBillIds = [...currentBillIds, ...lastPaidBillIds];

  const [{ data: minibarRows }, { data: poolbarRows }] = await Promise.all([
    allRelevantBillIds.length
      ? supabase
          .from("room_bill_minibar_items")
          .select("bill_id, minibar_item_id, quantity, price_snapshot, minibar_items(name)")
          .in("bill_id", allRelevantBillIds)
          .gt("quantity", 0)
      : Promise.resolve({ data: [] as unknown[] }),
    // Bar da piscina agora vem das comandas ativas (não canceladas) daquele
    // bill_id, em vez de um valor editado diretamente por item.
    allRelevantBillIds.length
      ? supabase
          .from("bar_comanda_items")
          .select(
            "quantity, price_snapshot, poolbar_item_id, poolbar_items(name), bar_comandas!inner(bill_id, status)"
          )
          .in("bar_comandas.bill_id", allRelevantBillIds)
          .neq("bar_comandas.status", "cancelada")
          .gt("quantity", 0)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const mbRows = (minibarRows ?? []) as unknown as MinibarRow[];
  const pbRows = (poolbarRows ?? []) as unknown as PoolbarRow[];

  return roomList.map((room) => {
    const currentBill = currentBillByRoom.get(room.id)!;
    const totals = computeBillTotals(currentBill.id, mbRows, pbRows, currentBill.serviceChargeWaived);

    const lastPaid = lastPaidByRoom.get(room.id);
    let lastPaidBill: RoomBillOverview["lastPaidBill"] = null;
    if (lastPaid) {
      const paidMinibarTotal = mbRows
        .filter((r) => r.bill_id === lastPaid.id)
        .reduce((sum, r) => sum + r.quantity * Number(r.price_snapshot), 0);
      const paidPoolbarSubtotal = pbRows
        .filter((r) => r.bar_comandas.bill_id === lastPaid.id)
        .reduce((sum, r) => sum + r.quantity * Number(r.price_snapshot), 0);
      const paidTotal =
        paidMinibarTotal + paidPoolbarSubtotal * (lastPaid.serviceChargeWaived ? 1 : 1 + SERVICE_CHARGE_RATE);
      lastPaidBill = { total: paidTotal, paid_at: lastPaid.paid_at };
    }

    return {
      room_id: room.id,
      room_number: room.number,
      bill_id: currentBill.id,
      status: currentBill.status,
      ...totals,
      closedByName: currentBill.closedByName,
      lastPaidBill,
    };
  });
}

// ---------- Recibo em PDF de uma conta paga (visualização e e-mail) ----------

// Busca os dados de UMA conta paga específica, no mesmo formato usado pelo
// PDF do recibo — reaproveitado tanto para gerar o link "Ver PDF" do admin
// quanto para montar o anexo do e-mail (envio automático e reenvio manual).
export async function getRoomBillReceiptData(billId: string): Promise<ReceiptData | null> {
  const supabase = await createClient();
  const { data: bill } = await supabase
    .from("room_bills")
    .select("paid_at, service_charge_waived, rooms(number)")
    .eq("id", billId)
    .single();
  if (!bill || !bill.paid_at) return null;

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
    paid_at: bill.paid_at,
    ...computeBillTotals(billId, mbRows, pbRows, bill.service_charge_waived),
  };
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
  revalidatePath("/dashboard/email-envio");
  return { success: true };
}

// "Melhor esforço": nunca lança — quem chama trata o retorno (true/false)
// e grava o resultado via mark_receipt_email_sent, sem travar o fluxo de
// pagamento por causa de um problema de rede/credencial do provedor de e-mail.
async function sendReceiptEmail(billId: string): Promise<boolean> {
  try {
    const data = await getRoomBillReceiptData(billId);
    if (!data) return false;

    const { accounting_email: accountingEmail } = await getReceiptSettings();
    if (!accountingEmail) return false;

    const pdfBuffer = await renderReceiptPdf(data);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RECEIPT_FROM_EMAIL ?? "Vila Corada <recibos@consumos.vilacorada.com.br>",
      to: accountingEmail,
      subject: `Conta paga — Suíte ${data.room_number}`,
      text: `Segue em anexo o recibo da conta paga da suíte ${data.room_number}.`,
      attachments: [{ filename: `conta-suite-${data.room_number}.pdf`, content: pdfBuffer }],
    });
    return !error;
  } catch {
    return false;
  }
}

// ---------- Leitura: contas pagas recentemente (rodapé de "Consumo por quartos" do admin) ----------

export interface RecentlyPaidBill {
  bill_id: string;
  room_id: string;
  room_number: string;
  paid_at: string;
  paidByName: string | null;
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
      "id, room_id, paid_at, receipt_email_sent, service_charge_waived, rooms(number), paid_by_profile:profiles!room_bills_paid_by_fkey(name)"
    )
    .eq("status", "paga")
    .gte("paid_at", cutoff)
    .order("paid_at", { ascending: false });

  type PaidBillRow = {
    id: string;
    room_id: string;
    paid_at: string;
    receipt_email_sent: boolean;
    service_charge_waived: boolean;
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
    paid_at: bill.paid_at,
    paidByName: bill.paid_by_profile?.name ?? null,
    receiptEmailSent: bill.receipt_email_sent,
    ...computeBillTotals(bill.id, mbRows, pbRows, bill.service_charge_waived),
  }));
}

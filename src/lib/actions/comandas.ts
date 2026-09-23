"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ComandaStatus } from "@/lib/types";
import { SERVICE_CHARGE_RATE } from "@/lib/room-bills";
import { nowInBrazil, toDateKey, dateKeyInBrazil, startOfDayBrasiliaUtc, nextDayBrasiliaUtcBoundary } from "@/lib/date";
import { EXCLUDED_CAMAREIRA_NAME, closedPeriodRange } from "@/lib/commission-math";

export interface ComandaItemInput {
  item_id: string;
  quantity: number;
}

function revalidateComandaPaths() {
  revalidatePath("/comanda");
  revalidatePath("/bar-piscina");
  revalidatePath("/frigobar");
}

export async function submitComanda(roomId: string, items: ComandaItemInput[]) {
  if (!roomId) return { error: "Selecione a suíte." };
  const validItems = items.filter((i) => i.quantity > 0);
  if (validItems.length === 0) return { error: "Selecione ao menos um item com quantidade." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_comanda", {
    p_room_id: roomId,
    p_items: validItems,
  });
  if (error) return { error: error.message };

  revalidateComandaPaths();
  return { success: true, comandaId: data as string };
}

export async function editComanda(comandaId: string, roomId: string, items: ComandaItemInput[]) {
  if (!roomId) return { error: "Selecione a suíte." };
  const validItems = items.filter((i) => i.quantity > 0);
  if (validItems.length === 0) return { error: "Selecione ao menos um item com quantidade." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_comanda", {
    p_comanda_id: comandaId,
    p_room_id: roomId,
    p_items: validItems,
  });
  if (error) return { error: error.message };

  revalidateComandaPaths();
  return { success: true };
}

export async function cancelComanda(comandaId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_comanda", { p_comanda_id: comandaId });
  if (error) return { error: error.message };

  revalidateComandaPaths();
  return { success: true };
}

// ---------- Leitura: listas de comandas (ativas e inativas) ----------

export interface ComandaListItem {
  id: string;
  room_id: string;
  room_number: string;
  sequence_number: number;
  // Número exibido nas telas ("Comanda #N") — sequencial por mês, pela
  // ordem de lançamento (ver migration 040). Nulo só pra comandas de
  // meses anteriores a essa migration, que nunca aparecem em tela (a
  // lista de inativas nunca olha mais que 7 dias pra trás); qualquer
  // exibição cai pro sequence_number nesse caso raro.
  monthly_number: number | null;
  status: ComandaStatus;
  created_at: string;
  created_by_name: string;
  last_action_at: string;
  last_action_by_name: string;
  items: ComandaListItemLine[];
  total: number;
  // Só preenchido para comandas inativas cuja conta foi paga (permite a UI
  // rotular como "Paga" em vez de "Original"/"Editada", já que não existe
  // um status "paga" na própria comanda — é a conta do quarto que é paga).
  bill_paid_at: string | null;
}

export interface ComandaListItemLine {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  price_snapshot: number;
  subtotal: number;
}

type ComandaRow = {
  id: string;
  room_id: string;
  sequence_number: number;
  monthly_number: number | null;
  status: ComandaStatus;
  created_at: string;
  last_action_at: string;
  rooms: { number: string } | null;
  created_by_profile: { name: string } | null;
  last_action_by_profile: { name: string } | null;
  room_bills: { paid_at: string | null } | null;
};

type ComandaItemRow = {
  comanda_id: string;
  id: string;
  quantity: number;
  price_snapshot: number;
  poolbar_items: { name: string; category: string | null } | null;
};

const COMANDA_ROW_SELECT =
  "id, room_id, sequence_number, monthly_number, status, created_at, last_action_at, rooms(number), created_by_profile:profiles!bar_comandas_created_by_fkey(name), last_action_by_profile:profiles!bar_comandas_last_action_by_fkey(name), room_bills!inner(status, paid_at)";

// Busca os itens de um conjunto de comandas já embutidos no resultado da
// lista (em vez de buscar item a item quando o usuário abre o modal de
// visualização) — evita um round trip extra por clique e mantém a tela
// responsiva, como pedido nos requisitos não funcionais.
async function attachItemsAndMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ComandaRow[]
): Promise<ComandaListItem[]> {
  if (rows.length === 0) return [];

  const comandaIds = rows.map((r) => r.id);
  const { data: itemRows } = await supabase
    .from("bar_comanda_items")
    .select("comanda_id, id, quantity, price_snapshot, poolbar_items(name, category)")
    .in("comanda_id", comandaIds);

  const itemsByComanda = new Map<string, ComandaListItemLine[]>();
  ((itemRows ?? []) as unknown as ComandaItemRow[]).forEach((r) => {
    const list = itemsByComanda.get(r.comanda_id) ?? [];
    list.push({
      id: r.id,
      name: r.poolbar_items?.name ?? "—",
      category: r.poolbar_items?.category ?? null,
      quantity: r.quantity,
      price_snapshot: r.price_snapshot,
      subtotal: r.quantity * Number(r.price_snapshot),
    });
    itemsByComanda.set(r.comanda_id, list);
  });

  return rows.map((r) => {
    const items = itemsByComanda.get(r.id) ?? [];
    return {
      id: r.id,
      room_id: r.room_id,
      room_number: r.rooms?.number ?? "—",
      sequence_number: r.sequence_number,
      monthly_number: r.monthly_number,
      status: r.status,
      created_at: r.created_at,
      created_by_name: r.created_by_profile?.name ?? "—",
      last_action_at: r.last_action_at,
      last_action_by_name: r.last_action_by_profile?.name ?? "—",
      items,
      total: items.reduce((sum, i) => sum + i.subtotal, 0),
      bill_paid_at: r.room_bills?.paid_at ?? null,
    };
  });
}

// Comandas em aberto: não canceladas e pertencentes à conta corrente (não
// paga) do quarto. É a lista que a camareira vê em "Comanda" e também a
// seção "Comandas ativas" da tela do admin — a numeração sequencial nunca
// se repete aqui (é por conta, e só existe uma conta não-paga por quarto).
export async function getActiveComandas(): Promise<ComandaListItem[]> {
  const supabase = await createClient();

  const { data: comandas, error } = await supabase
    .from("bar_comandas")
    .select(COMANDA_ROW_SELECT)
    .neq("status", "cancelada")
    .neq("room_bills.status", "paga")
    .order("last_action_at", { ascending: false });

  if (error) throw new Error(error.message);

  return attachItemsAndMap(supabase, (comandas ?? []) as unknown as ComandaRow[]);
}

// Comandas inativas (só na tela do admin): canceladas, ou pertencentes a
// uma conta já paga — nos dois casos, apenas dos últimos `days` dias
// (contados a partir do momento em que cada uma virou inativa: a data do
// cancelamento, ou a data em que a conta foi paga). A mesma numeração
// sequencial de uma comanda ativa é preservada ao virar inativa, podendo
// se repetir entre contas diferentes do mesmo quarto — só não pode se
// repetir dentro da lista de comandas ativas.
export async function getInactiveComandas(days = 7): Promise<ComandaListItem[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: cancelled, error: cancelledError }, { data: paid, error: paidError }] = await Promise.all([
    supabase
      .from("bar_comandas")
      .select(COMANDA_ROW_SELECT)
      .eq("status", "cancelada")
      .gte("last_action_at", cutoff),
    supabase
      .from("bar_comandas")
      .select(COMANDA_ROW_SELECT)
      .neq("status", "cancelada")
      .eq("room_bills.status", "paga")
      .gte("room_bills.paid_at", cutoff),
  ]);

  if (cancelledError) throw new Error(cancelledError.message);
  if (paidError) throw new Error(paidError.message);

  const rows = [
    ...((cancelled ?? []) as unknown as ComandaRow[]),
    ...((paid ?? []) as unknown as ComandaRow[]),
  ];
  // Mais recente primeiro: data do cancelamento para as canceladas, data do
  // pagamento da conta para as demais.
  rows.sort((a, b) => {
    const dateA = a.status === "cancelada" ? a.last_action_at : a.room_bills?.paid_at ?? a.last_action_at;
    const dateB = b.status === "cancelada" ? b.last_action_at : b.room_bills?.paid_at ?? b.last_action_at;
    return dateB.localeCompare(dateA);
  });

  return attachItemsAndMap(supabase, rows);
}

// ---------- Leitura: dados para o formulário "Novo pedido" / edição ----------

export interface ComandaFormData {
  room_id: string;
  quantities: Record<string, number>;
  // Status da comanda em si e da conta a que ela pertence NESTE MOMENTO —
  // não confundir com o status da conta CORRENTE do quarto: uma comanda
  // antiga pode pertencer a uma conta já paga mesmo que o quarto já tenha,
  // desde então, uma conta nova "aberta" em andamento. É esse status (o da
  // própria comanda) que decide se o formulário pode ficar editável.
  comanda_status: ComandaStatus;
  bill_status: "aberta" | "fechada" | "reaberta" | "paga";
}

export async function getComandaForEdit(comandaId: string): Promise<ComandaFormData | null> {
  const supabase = await createClient();
  const { data: comanda } = await supabase
    .from("bar_comandas")
    .select("room_id, status, room_bills(status)")
    .eq("id", comandaId)
    .single();
  if (!comanda) return null;

  const billStatus = (comanda as unknown as { room_bills: { status: ComandaFormData["bill_status"] } | null })
    .room_bills?.status;

  const { data: itemRows } = await supabase
    .from("bar_comanda_items")
    .select("poolbar_item_id, quantity")
    .eq("comanda_id", comandaId);

  const quantities: Record<string, number> = {};
  (itemRows ?? []).forEach((r) => {
    quantities[r.poolbar_item_id] = r.quantity;
  });

  return {
    room_id: comanda.room_id,
    quantities,
    comanda_status: comanda.status,
    bill_status: billStatus ?? "aberta",
  };
}

export interface RoomOption {
  room_id: string;
  room_number: string;
  billStatus: "aberta" | "fechada" | "reaberta" | "paga";
}

export async function getRoomsForComandaSelector(): Promise<RoomOption[]> {
  const supabase = await createClient();
  const [{ data: rooms }, { data: bills }] = await Promise.all([
    supabase.from("rooms").select("id, number").eq("active", true).order("position"),
    supabase.from("room_bills").select("room_id, status").neq("status", "paga"),
  ]);

  const statusByRoom = new Map((bills ?? []).map((b) => [b.room_id, b.status]));

  return (rooms ?? []).map((room) => ({
    room_id: room.id,
    room_number: room.number,
    billStatus: statusByRoom.get(room.id) ?? "aberta",
  }));
}

// ---------- Leitura: comissão de 10% do bar por camareira (Resumo Executivo) ----------

export interface CamareiraBarCommissionRow {
  camareira_id: string | null;
  camareira_name: string;
  commission: number;
}

export interface BarCommissionByCamareiraSummary {
  currentMonth: CamareiraBarCommissionRow[];
  previousMonth: CamareiraBarCommissionRow[];
}

type BarCommissionItemRow = {
  quantity: number;
  price_snapshot: number;
  bar_comandas: {
    status: ComandaStatus;
    created_at: string;
    created_by: string | null;
    created_by_profile: { name: string } | null;
    // Se a conta a que esta comanda pertence teve a taxa de serviço de
    // 10% isentada (o hóspede recusou o pagamento) — nesse caso a comanda
    // não entra na comissão de quem a lançou, mesmo não estando cancelada.
    room_bills: { service_charge_waived: boolean } | null;
  };
};

async function fetchBarCommissionRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string
): Promise<BarCommissionItemRow[]> {
  const { data } = await supabase
    .from("bar_comanda_items")
    .select(
      "quantity, price_snapshot, bar_comandas!inner(status, created_at, created_by, created_by_profile:profiles!bar_comandas_created_by_fkey(name), room_bills(service_charge_waived))"
    )
    .neq("bar_comandas.status", "cancelada")
    // created_at é um instante real (timestamptz) — comparar contra
    // strings ingênuas tipo `${to}T23:59:59` erraria por até 3h, já que
    // Brasília é UTC-3 (ver startOfDayBrasiliaUtc/nextDayBrasiliaUtcBoundary).
    .gte("bar_comandas.created_at", startOfDayBrasiliaUtc(from))
    .lt("bar_comandas.created_at", nextDayBrasiliaUtcBoundary(to))
    .gt("quantity", 0);

  return (data ?? []) as unknown as BarCommissionItemRow[];
}

function summarizeBarCommissionRows(rows: BarCommissionItemRow[]): CamareiraBarCommissionRow[] {
  const byCamareira = new Map<string, CamareiraBarCommissionRow>();
  rows.forEach((r) => {
    if (r.bar_comandas.room_bills?.service_charge_waived) return;
    // "admin-camareira" é uma conta de teste/ajuste do admin, não uma
    // camareira de verdade — nunca entra no cálculo de comissão nem nos
    // demonstrativos/relatórios.
    if (r.bar_comandas.created_by_profile?.name === EXCLUDED_CAMAREIRA_NAME) return;
    const key = r.bar_comandas.created_by ?? "—";
    const entry = byCamareira.get(key) ?? {
      camareira_id: r.bar_comandas.created_by,
      camareira_name: r.bar_comandas.created_by_profile?.name ?? "—",
      commission: 0,
    };
    entry.commission += r.quantity * Number(r.price_snapshot) * SERVICE_CHARGE_RATE;
    byCamareira.set(key, entry);
  });
  return Array.from(byCamareira.values()).sort((a, b) => b.commission - a.commission);
}

// Comissão de 10% do bar da piscina atribuída à camareira que lançou a
// comanda ORIGINALMENTE (created_by) — mesmo que outra tenha feito alguma
// edição depois, é sempre quem lançou que recebe os 10% daquela comanda.
// Somada pelo mês em que a comanda foi lançada (created_at), não pela
// data de pagamento da conta (diferente do relatório geral de consumo em
// poolbar.ts, que soma por paid_at): o objetivo aqui é creditar a
// camareira no mês em que ela de fato atendeu o pedido, não em qualquer
// mês futuro em que o hóspede resolver pagar a conta. Não entram: comandas
// canceladas (nenhum consumo de verdade aconteceu) e comandas cuja conta
// teve a taxa de serviço isentada (o hóspede recusou o pagamento dela —
// ver setServiceChargeWaived em room-bills.ts).
export async function getBarCommissionByCamareira(): Promise<BarCommissionByCamareiraSummary> {
  const supabase = await createClient();
  const now = nowInBrazil();
  const currentStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const currentEnd = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
  const prevStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const prevEnd = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));

  const rows = await fetchBarCommissionRows(supabase, prevStart, currentEnd);

  const currentMonthRows = rows.filter((r) => {
    const d = dateKeyInBrazil(r.bar_comandas.created_at);
    return d >= currentStart && d <= currentEnd;
  });
  const previousMonthRows = rows.filter((r) => {
    const d = dateKeyInBrazil(r.bar_comandas.created_at);
    return d >= prevStart && d <= prevEnd;
  });

  return {
    currentMonth: summarizeBarCommissionRows(currentMonthRows),
    previousMonth: summarizeBarCommissionRows(previousMonthRows),
  };
}

// Mesma comissão de 10% por camareira, pra um período arbitrário (usado
// pelo Histórico, que já tem seu próprio seletor de datas) — mesmas
// regras de exclusão (canceladas e contas isentas não entram).
export async function getBarCommissionByCamareiraForPeriod(
  from: string,
  to: string
): Promise<CamareiraBarCommissionRow[]> {
  const supabase = await createClient();
  const rows = await fetchBarCommissionRows(supabase, from, to);
  return summarizeBarCommissionRows(rows);
}

// ---------- Leitura: comissão de 10% do bar por camareira (tela "Comissões das camareiras") ----------

export interface BarCommissionScreenSummary {
  currentMonthEstimate: CamareiraBarCommissionRow[];
  closedPeriod: {
    periodEnd: string;
    rows: CamareiraBarCommissionRow[];
  };
}

// Mesma comissão de 10% do bar de sempre (ver getBarCommissionByCamareira),
// mas reorganizada em torno do mesmo conceito de "último período fechado"
// usado pela comissão de serviços nas suítes e no café (Parte 36): fecha
// sempre no dia 25, não no fim do mês calendário, pra dar tempo de
// conferir e pagar antes do mês virar (ver closedPeriodRange). Diferente
// da comissão de suítes e café, aqui não existe nenhuma nota editável
// pra capturar num instante — o valor de um período já fechado nunca
// muda, então basta recalcular ao vivo a cada carregamento da tela, sem
// precisar de um botão "Calcular" nem de uma tabela de retrato congelado.
export async function getBarCommissionScreenSummary(): Promise<BarCommissionScreenSummary> {
  const now = nowInBrazil();
  const monthStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const today = toDateKey(now);
  const { periodEnd, start, end } = closedPeriodRange(now);

  const [currentMonthEstimate, closedPeriodRows] = await Promise.all([
    getBarCommissionByCamareiraForPeriod(monthStart, today),
    getBarCommissionByCamareiraForPeriod(start, end),
  ]);

  return {
    currentMonthEstimate,
    closedPeriod: { periodEnd, rows: closedPeriodRows },
  };
}

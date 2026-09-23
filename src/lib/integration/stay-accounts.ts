import type { createAdminClient } from "@/lib/supabase/admin";
import { computeBillTotals, SERVICE_CHARGE_RATE, type MinibarRow, type PoolbarRow } from "@/lib/room-bills";
import type { PaymentMethod, RoomBillGuestSlot, RoomBillStatus } from "@/lib/types";

type SupabaseClient = ReturnType<typeof createAdminClient>;

// Monta o objeto "conta" da API de consumos (PRD_consumos-api-joao-v1.md)
// a partir dos dados reais deste app — ver a tabela de mapeamento no plano
// desta parte (CLAUDE.md) pra cada divergência do contrato original.
//
// Simplificações deliberadas, documentadas também no openapi.yaml:
// - Itens são agregados por (conta, produto), não por lançamento
//   individual — não há hora nem motivo de cancelamento por item (uma
//   comanda cancelada simplesmente não aparece, não vira "item cancelado").
// - Pagamento é sempre 1 só, integral, nunca parcial/estorno.
// - `reservation.reference` é sempre null (só guardamos o _id opaco).
// - Não há `room_assignments` com hora de troca de quarto.
const PROPERTY_ID = "vila-corada";

export interface IntegrationAccountItem {
  id: string;
  category: "minibar" | "pool_bar";
  product_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  gross_cents: number;
  discount_cents: number;
  service_charge_cents: number;
  service_charge_waived: boolean;
  total_cents: number;
  status: "active";
}

export interface IntegrationPayment {
  id: string;
  method: PaymentMethod;
  amount_cents: number;
  occurred_at: string;
}

export interface IntegrationAccount {
  account_id: string;
  stay_id: string | null;
  property_id: string;
  version: number;
  status: "open" | "closed_pending_payment" | "paid";
  currency: "BRL";
  room_id: string;
  room_number: string;
  guest_slot: RoomBillGuestSlot;
  reservation: { stays_id: string | null; reference: null; link_status: "linked" | "unlinked" };
  items: IntegrationAccountItem[];
  payments: IntegrationPayment[];
  payment_data_quality: "complete" | "not_recorded";
  totals: {
    gross_cents: number;
    discount_cents: number;
    service_charge_cents: number;
    total_cents: number;
    reported_paid_cents: number | null;
    reported_balance_cents: number | null;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  paid_at: string | null;
  cancelled_at: null;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function mapStatus(status: RoomBillStatus): IntegrationAccount["status"] {
  if (status === "fechada") return "closed_pending_payment";
  if (status === "paga") return "paid";
  return "open"; // aberta | reaberta
}

type BillRow = {
  id: string;
  room_id: string;
  status: RoomBillStatus;
  guest_slot: RoomBillGuestSlot;
  stays_reservation_id: string | null;
  version: number;
  service_charge_waived: boolean;
  payment_method: PaymentMethod | null;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
  paid_at: string | null;
  rooms: { number: string } | null;
};

const BILL_SELECT =
  "id, room_id, status, guest_slot, stays_reservation_id, version, service_charge_waived, payment_method, opened_at, updated_at, closed_at, paid_at, rooms(number)";

async function fetchItemsAndTotals(supabase: SupabaseClient, billId: string, waived: boolean) {
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
  const totals = computeBillTotals(billId, mbRows, pbRows, waived);

  const items: IntegrationAccountItem[] = [
    ...totals.minibarItems.map((i) => ({
      id: `minibar:${i.id}`,
      category: "minibar" as const,
      product_id: i.id,
      description: i.name,
      quantity: i.quantity,
      unit_price_cents: i.quantity > 0 ? Math.round((i.subtotal / i.quantity) * 100) : 0,
      gross_cents: toCents(i.subtotal),
      discount_cents: 0,
      service_charge_cents: 0, // frigobar nunca tem taxa de serviço
      service_charge_waived: false,
      total_cents: toCents(i.subtotal),
      status: "active" as const,
    })),
    ...totals.poolbarItems.map((i) => {
      const grossCents = toCents(i.subtotal);
      const serviceChargeCents = waived ? 0 : Math.round(grossCents * SERVICE_CHARGE_RATE);
      return {
        id: `pool_bar:${i.id}`,
        category: "pool_bar" as const,
        product_id: i.id,
        description: i.name,
        quantity: i.quantity,
        unit_price_cents: i.quantity > 0 ? Math.round((i.subtotal / i.quantity) * 100) : 0,
        gross_cents: grossCents,
        discount_cents: 0,
        service_charge_cents: serviceChargeCents,
        service_charge_waived: waived,
        total_cents: grossCents + serviceChargeCents,
        status: "active" as const,
      };
    }),
  ];

  return { items, totals };
}

export async function buildIntegrationAccount(supabase: SupabaseClient, bill: BillRow): Promise<IntegrationAccount> {
  const { items, totals } = await fetchItemsAndTotals(supabase, bill.id, bill.service_charge_waived);

  const grossCents = toCents(totals.minibarTotal + totals.poolbarSubtotal);
  const serviceChargeCents = toCents(totals.serviceCharge);
  const totalCents = toCents(totals.grandTotal);

  const isPaid = bill.status === "paga";
  const payments: IntegrationPayment[] =
    isPaid && bill.payment_method && bill.paid_at
      ? [
          {
            id: `${bill.id}-payment`,
            method: bill.payment_method,
            amount_cents: totalCents,
            occurred_at: bill.paid_at,
          },
        ]
      : [];

  return {
    account_id: bill.id,
    stay_id: bill.stays_reservation_id,
    property_id: PROPERTY_ID,
    version: bill.version,
    status: mapStatus(bill.status),
    currency: "BRL",
    room_id: bill.room_id,
    room_number: bill.rooms?.number ?? "—",
    guest_slot: bill.guest_slot,
    reservation: {
      stays_id: bill.stays_reservation_id,
      reference: null,
      link_status: bill.stays_reservation_id ? "linked" : "unlinked",
    },
    items,
    payments,
    // "complete" exige ter um pagamento de verdade registrado — uma conta
    // paga antes de existir a coluna payment_method (ou paga por algum
    // caminho que não a gravou) fica "not_recorded" mesmo com status
    // "paid": sabemos que foi paga, mas não como.
    payment_data_quality: payments.length > 0 ? "complete" : "not_recorded",
    totals: {
      gross_cents: grossCents,
      discount_cents: 0,
      service_charge_cents: serviceChargeCents,
      total_cents: totalCents,
      reported_paid_cents: payments.length > 0 ? totalCents : null,
      reported_balance_cents: payments.length > 0 ? 0 : null,
    },
    created_at: bill.opened_at,
    updated_at: bill.updated_at,
    closed_at: bill.closed_at,
    paid_at: bill.paid_at,
    cancelled_at: null,
  };
}

export async function getStayAccount(supabase: SupabaseClient, accountId: string): Promise<IntegrationAccount | null> {
  const { data: bill } = await supabase.from("room_bills").select(BILL_SELECT).eq("id", accountId).maybeSingle();
  if (!bill) return null;
  return buildIntegrationAccount(supabase, bill as unknown as BillRow);
}

export interface StayAccountsPage {
  data: IntegrationAccount[];
  next_cursor: string | null;
  has_more: boolean;
  snapshot_id?: string;
  sync_cursor?: string;
}

// Paginação por keyset (id, ordem crescente) — estável mesmo com escrita
// concorrente, mais simples que um mecanismo de snapshot dedicado, dado o
// volume pequeno de contas desta pousada.
export async function listStayAccounts(
  supabase: SupabaseClient,
  { cursor, limit }: { cursor: string | null; limit: number }
): Promise<StayAccountsPage> {
  let query = supabase.from("room_bills").select(BILL_SELECT).order("id", { ascending: true }).limit(limit + 1);
  if (cursor) query = query.gt("id", cursor);
  const { data: bills } = await query;

  const rows = (bills ?? []) as unknown as BillRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const data = await Promise.all(page.map((bill) => buildIntegrationAccount(supabase, bill)));
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const result: StayAccountsPage = { data, next_cursor: nextCursor, has_more: hasMore };

  if (!cursor) {
    // Só a primeira página de uma carga inicial carrega snapshot_id/sync_cursor.
    const { data: lastEvent } = await supabase
      .from("room_bill_change_events")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    result.snapshot_id = crypto.randomUUID();
    result.sync_cursor = String(lastEvent?.id ?? 0);
  }

  return result;
}

export interface ChangeEvent {
  event_id: string;
  occurred_at: string;
  account_id: string;
  version: number;
  type: "account.updated";
  account: IntegrationAccount;
}

export interface ChangesPage {
  data: ChangeEvent[];
  next_cursor: string;
  has_more: boolean;
}

const CHANGE_RETENTION_DAYS = 90;

export async function listChanges(
  supabase: SupabaseClient,
  { cursor, limit }: { cursor: string; limit: number }
): Promise<ChangesPage | { expired: true }> {
  const cursorNum = Number(cursor);
  if (!Number.isFinite(cursorNum) || cursorNum < 0) {
    // Cursor inválido é tratado como expirado pelo chamador (400 vs 410
    // fica a critério da rota) — aqui só sinaliza que não deu pra usar.
    return { expired: true };
  }

  // Cursor mais antigo que a retenção: não temos como garantir que nada
  // foi perdido — força reinício da carga completa.
  const { data: oldestEvent } = await supabase
    .from("room_bill_change_events")
    .select("id, occurred_at")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (oldestEvent && cursorNum > 0) {
    const retentionCutoff = Date.now() - CHANGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    if (new Date(oldestEvent.occurred_at).getTime() > retentionCutoff && cursorNum < oldestEvent.id - 1) {
      return { expired: true };
    }
  }

  const { data: events } = await supabase
    .from("room_bill_change_events")
    .select("id, bill_id, version, occurred_at")
    .gt("id", cursorNum)
    .order("id", { ascending: true })
    .limit(limit);

  const rows = events ?? [];
  const accounts = new Map<string, IntegrationAccount>();
  for (const row of rows) {
    if (!accounts.has(row.bill_id)) {
      const account = await getStayAccount(supabase, row.bill_id);
      if (account) accounts.set(row.bill_id, account);
    }
  }

  const data: ChangeEvent[] = rows
    .filter((r) => accounts.has(r.bill_id))
    .map((r) => ({
      event_id: String(r.id),
      occurred_at: r.occurred_at,
      account_id: r.bill_id,
      version: r.version,
      type: "account.updated" as const,
      account: accounts.get(r.bill_id)!,
    }));

  const nextCursor = rows.length > 0 ? String(rows[rows.length - 1].id) : cursor;
  return { data, next_cursor: nextCursor, has_more: rows.length === limit };
}

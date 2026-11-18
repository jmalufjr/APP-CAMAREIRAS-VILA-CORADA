"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toDateKey, nowInBrazil, dateKeyInBrazil } from "@/lib/date";
import { findLastNightOccupant, findBillForOccupant, ensureBillForOccupant, hasPaidBillOnly } from "@/lib/room-occupancy";

// ---------- Admin: CRUD do catálogo de itens de frigobar ----------

export async function createMinibarItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));
  if (!name) return { error: "Informe o nome do item." };
  if (!Number.isFinite(price) || price < 0) return { error: "Informe um preço válido." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("minibar_items")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase
    .from("minibar_items")
    .insert({ name, price, position: (max?.position ?? 0) + 1 });

  if (error) return { error: error.message };
  revalidatePath("/checklists");
  revalidatePath("/tarefas");
  revalidatePath("/frigobar");
  return { success: true };
}

export async function updateMinibarItem(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));
  const active = formData.get("active") === "on";
  if (!name) return { error: "Informe o nome do item." };
  if (!Number.isFinite(price) || price < 0) return { error: "Informe um preço válido." };

  const supabase = await createClient();
  const { error } = await supabase.from("minibar_items").update({ name, price, active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  revalidatePath("/tarefas");
  revalidatePath("/frigobar");
  return { success: true };
}

export async function deleteMinibarItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("minibar_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  revalidatePath("/frigobar");
  return { success: true };
}

// ---------- Camareira/admin: ajustar o consumo ACUMULADO de uma conta de frigobar ----------

// Grava a quantidade total (absoluta) de um item na conta. Usado só nas telas de conta
// (reabrir pra corrigir) e na correção de serviço — o checklist do serviço NÃO usa isto:
// ele só soma o consumo do dia, ao finalizar (ver finalizeService em tasks.ts).
// A conta fechada não aceita lançamento (regra dentro da função do banco).
export async function setMinibarConsumption(billId: string, itemId: string, quantity: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_minibar_consumption", {
    p_bill_id: billId,
    p_minibar_item_id: itemId,
    p_quantity: Math.max(0, Math.floor(quantity)),
  });
  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  return { success: true };
}

// Lançamento adicional: só com a conta FECHADA, sem reabrir (o checklist continua bloqueado em conta fechada).
export async function addMinibarOnClosedBill(billId: string, itemId: string, quantity: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_minibar_consumption_closed", {
    p_bill_id: billId,
    p_minibar_item_id: itemId,
    p_quantity: Math.max(0, Math.floor(quantity)),
  });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  return { success: true };
}

// Edita diretamente uma coluna da tabela de consumo (aberta, reaberta ou fechada; nunca paga). Fica no
// histórico (quem, quando, valor anterior). O lançamento original do serviço não muda.
export async function editMinibarColumn(billId: string, columnKey: string, changes: { itemId: string; quantity: number }[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_minibar_column", {
    p_bill_id: billId,
    p_column_key: columnKey,
    p_changes: changes.map((c) => ({ item_id: c.itemId, quantity: Math.max(0, Math.floor(c.quantity)) })),
  });
  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  return { success: true };
}

// ---------- Camareira: contexto do frigobar de um serviço (tela de checklist) ----------

export interface MinibarTaskContext {
  // Conta de quem dormiu na suíte na noite anterior (null = ainda não existe ou não foi possível identificar).
  billId: string | null;
  billStatus: "aberta" | "fechada" | "reaberta" | "paga" | null;
  guestName: string | null;
  // true se foi possível descobrir quem dormiu na suíte na noite anterior.
  resolved: boolean;
  // Quantidade só vem preenchida (acumulado da conta) quando `withAccumulated` é pedido.
  items: { id: string; name: string; price: number; quantity: number }[];
}

export async function getMinibarContextForTask(
  roomId: string,
  date: string,
  options: { withAccumulated?: boolean; ensureBill?: boolean } = {}
): Promise<MinibarTaskContext> {
  const supabase = await createClient();
  const occupant = await findLastNightOccupant(supabase, roomId, date);

  let bill = occupant ? await findBillForOccupant(supabase, roomId, occupant) : null;
  // Conta já paga: não aceita mais nada (nem é recriada).
  const paidOnly = !bill && occupant ? await hasPaidBillOnly(supabase, roomId, occupant) : false;
  if (!bill && occupant && options.ensureBill && !paidOnly) {
    bill = await ensureBillForOccupant(supabase, roomId, occupant);
  }

  const { data: items } = await supabase.from("minibar_items").select("*").eq("active", true).order("position");
  let quantityByItem = new Map<string, number>();
  if (options.withAccumulated && bill) {
    const { data: lines } = await supabase
      .from("room_bill_minibar_items")
      .select("minibar_item_id, quantity")
      .eq("bill_id", bill.id);
    quantityByItem = new Map((lines ?? []).map((l) => [l.minibar_item_id as string, l.quantity as number]));
  }

  return {
    billId: bill?.id ?? null,
    billStatus: paidOnly ? "paga" : ((bill?.status as MinibarTaskContext["billStatus"]) ?? null),
    guestName: bill?.guest_name_hint ?? occupant?.guestName ?? null,
    resolved: occupant !== null,
    items: (items ?? []).map((item) => ({
      id: item.id as string,
      name: item.name as string,
      price: Number(item.price),
      quantity: quantityByItem.get(item.id as string) ?? 0,
    })),
  };
}

// ---------- Relatórios: histórico (por período) e dashboard (mensal) ----------
// Baseados na data em que a conta foi PAGA (não na data do consumo em si,
// já que o consumo não é mais vinculado a um dia específico).

export interface MinibarItemTotal {
  name: string;
  quantity: number;
  total: number;
}

function summarizeRows(
  rows: { quantity: number; price_snapshot: number; name: string; date: string }[],
  filterFn: (date: string) => boolean
): { items: MinibarItemTotal[]; total: number } {
  const byItem = new Map<string, MinibarItemTotal>();
  rows
    .filter((r) => filterFn(r.date))
    .forEach((r) => {
      const entry = byItem.get(r.name) ?? { name: r.name, quantity: 0, total: 0 };
      entry.quantity += r.quantity;
      entry.total += r.quantity * Number(r.price_snapshot);
      byItem.set(r.name, entry);
    });
  const items = Array.from(byItem.values()).sort((a, b) => b.total - a.total);
  return { items, total: items.reduce((sum, i) => sum + i.total, 0) };
}

async function getPaidMinibarRows(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("room_bill_minibar_items")
    .select("quantity, price_snapshot, minibar_items(name), room_bills!inner(status, paid_at)")
    .eq("room_bills.status", "paga")
    .gt("quantity", 0);

  type Row = {
    quantity: number;
    price_snapshot: number;
    minibar_items: { name: string } | null;
    room_bills: { status: string; paid_at: string | null };
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.room_bills.paid_at)
    .map((r) => ({
      quantity: r.quantity,
      price_snapshot: r.price_snapshot,
      name: r.minibar_items?.name ?? "—",
      // dateKeyInBrazil, não .slice(0,10): paid_at é um instante real
      // (timestamptz) — fatiar os 10 primeiros caracteres dá o dia em
      // UTC, que já é o dia seguinte pra pagamentos feitos entre 21h e
      // 23h59 em Brasília (UTC-3).
      date: dateKeyInBrazil(r.room_bills.paid_at as string),
    }));
}

export async function getMinibarConsumptionForPeriod(
  from: string,
  to: string
): Promise<{ items: MinibarItemTotal[]; total: number }> {
  const supabase = await createClient();
  const rows = await getPaidMinibarRows(supabase);
  return summarizeRows(rows, (d) => d >= from && d <= to);
}

export interface MinibarMonthlySummary {
  currentMonth: { items: MinibarItemTotal[]; total: number };
  previousMonth: { items: MinibarItemTotal[]; total: number };
  allTime: { items: MinibarItemTotal[]; total: number };
}

export async function getMinibarMonthlySummary(): Promise<MinibarMonthlySummary> {
  const supabase = await createClient();
  const now = nowInBrazil();
  const currentStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const currentEnd = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
  const prevStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const prevEnd = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));

  const rows = await getPaidMinibarRows(supabase);

  return {
    currentMonth: summarizeRows(rows, (d) => d >= currentStart && d <= currentEnd),
    previousMonth: summarizeRows(rows, (d) => d >= prevStart && d <= prevEnd),
    allTime: summarizeRows(rows, () => true),
  };
}

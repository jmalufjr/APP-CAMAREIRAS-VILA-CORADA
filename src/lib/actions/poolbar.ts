"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toDateKey } from "@/lib/date";
import { getOrCreateCurrentBill } from "@/lib/room-bills";

// ---------- Admin: CRUD do catálogo de itens do bar da piscina ----------

export async function createPoolbarItem(formData: FormData) {
  const category = String(formData.get("category") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));
  if (!name) return { error: "Informe o nome do item." };
  if (!Number.isFinite(price) || price < 0) return { error: "Informe um preço válido." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("poolbar_items")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase
    .from("poolbar_items")
    .insert({ category, name, price, position: (max?.position ?? 0) + 1 });

  if (error) return { error: error.message };
  revalidatePath("/checklists");
  revalidatePath("/bar-piscina");
  revalidatePath("/frigobar");
  return { success: true };
}

export async function updatePoolbarItem(id: string, formData: FormData) {
  const category = String(formData.get("category") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));
  const active = formData.get("active") === "on";
  if (!name) return { error: "Informe o nome do item." };
  if (!Number.isFinite(price) || price < 0) return { error: "Informe um preço válido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("poolbar_items")
    .update({ category, name, price, active })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  revalidatePath("/bar-piscina");
  revalidatePath("/frigobar");
  return { success: true };
}

export async function deletePoolbarItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("poolbar_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  revalidatePath("/bar-piscina");
  return { success: true };
}

// ---------- Camareira/admin: registrar consumo do bar da piscina na conta corrente do quarto ----------

export async function setPoolbarConsumption(roomId: string, itemId: string, quantity: number) {
  const supabase = await createClient();

  const bill = await getOrCreateCurrentBill(supabase, roomId);
  if (bill.status === "fechada") {
    return { error: "A conta deste quarto está fechada. Não é possível registrar consumo." };
  }

  const { data: item } = await supabase.from("poolbar_items").select("price").eq("id", itemId).single();
  if (!item) return { error: "Item de bar não encontrado." };

  const { error } = await supabase.from("room_bill_poolbar_items").upsert(
    {
      bill_id: bill.id,
      poolbar_item_id: itemId,
      quantity: Math.max(0, Math.floor(quantity)),
      price_snapshot: item.price,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bill_id,poolbar_item_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/bar-piscina");
  revalidatePath("/frigobar");
  return { success: true };
}

// ---------- Camareira: cards de consumo de bar por quarto ----------

export interface PoolbarRoomCard {
  room_id: string;
  room_number: string;
  billStatus: "aberta" | "fechada" | "reaberta" | "paga";
  items: { id: string; category: string | null; name: string; price: number; quantity: number }[];
}

export async function getPoolbarRoomsForCamareira(): Promise<PoolbarRoomCard[]> {
  const supabase = await createClient();
  const [{ data: rooms }, { data: items }, { data: bills }] = await Promise.all([
    supabase.from("rooms").select("id, number").eq("active", true).order("position"),
    supabase.from("poolbar_items").select("*").eq("active", true).order("position"),
    supabase.from("room_bills").select("*").neq("status", "paga"),
  ]);

  const roomList = rooms ?? [];
  const itemList = items ?? [];
  const billByRoom = new Map((bills ?? []).map((b) => [b.room_id, b]));

  // garante que toda sala tenha uma conta corrente antes de buscar os lançamentos
  const billIdByRoom = new Map<string, string>();
  const billStatusByRoom = new Map<string, PoolbarRoomCard["billStatus"]>();
  for (const room of roomList) {
    let bill = billByRoom.get(room.id);
    if (!bill) {
      bill = await getOrCreateCurrentBill(supabase, room.id);
    }
    billIdByRoom.set(room.id, bill.id);
    billStatusByRoom.set(room.id, bill.status);
  }

  const billIds = Array.from(billIdByRoom.values());
  const { data: lines } = billIds.length
    ? await supabase.from("room_bill_poolbar_items").select("bill_id, poolbar_item_id, quantity").in("bill_id", billIds)
    : { data: [] as { bill_id: string; poolbar_item_id: string; quantity: number }[] };

  return roomList.map((room) => {
    const billId = billIdByRoom.get(room.id)!;
    const quantityByItem = new Map(
      (lines ?? []).filter((l) => l.bill_id === billId).map((l) => [l.poolbar_item_id, l.quantity])
    );
    return {
      room_id: room.id,
      room_number: room.number,
      billStatus: billStatusByRoom.get(room.id)!,
      items: itemList.map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        price: item.price,
        quantity: quantityByItem.get(item.id) ?? 0,
      })),
    };
  });
}

// ---------- Relatórios: histórico (por período) e dashboard (mensal) ----------
// Mesmo critério do frigobar: soma pela data em que a conta foi PAGA
// (paid_at), já que o consumo não tem mais uma data própria (é lançado
// contra a conta corrente do quarto, que pode ficar aberta por vários dias).

export interface PoolbarItemTotal {
  name: string;
  quantity: number;
  total: number;
}

function summarizePoolbarRows(
  rows: { quantity: number; price_snapshot: number; name: string; date: string }[],
  filterFn: (date: string) => boolean
): { items: PoolbarItemTotal[]; total: number } {
  const byItem = new Map<string, PoolbarItemTotal>();
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

async function getPaidPoolbarRows(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("room_bill_poolbar_items")
    .select("quantity, price_snapshot, poolbar_items(name), room_bills!inner(status, paid_at)")
    .eq("room_bills.status", "paga")
    .gt("quantity", 0);

  type Row = {
    quantity: number;
    price_snapshot: number;
    poolbar_items: { name: string } | null;
    room_bills: { status: string; paid_at: string | null };
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.room_bills.paid_at)
    .map((r) => ({
      quantity: r.quantity,
      price_snapshot: r.price_snapshot,
      name: r.poolbar_items?.name ?? "—",
      date: (r.room_bills.paid_at as string).slice(0, 10),
    }));
}

export async function getPoolbarConsumptionForPeriod(
  from: string,
  to: string
): Promise<{ items: PoolbarItemTotal[]; total: number }> {
  const supabase = await createClient();
  const rows = await getPaidPoolbarRows(supabase);
  return summarizePoolbarRows(rows, (d) => d >= from && d <= to);
}

export interface PoolbarMonthlySummary {
  currentMonth: { items: PoolbarItemTotal[]; total: number };
  previousMonth: { items: PoolbarItemTotal[]; total: number };
  allTime: { items: PoolbarItemTotal[]; total: number };
}

export async function getPoolbarMonthlySummary(): Promise<PoolbarMonthlySummary> {
  const supabase = await createClient();
  const now = new Date();
  const currentStart = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const currentEnd = toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const prevStart = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevEnd = toDateKey(new Date(now.getFullYear(), now.getMonth(), 0));

  const rows = await getPaidPoolbarRows(supabase);

  return {
    currentMonth: summarizePoolbarRows(rows, (d) => d >= currentStart && d <= currentEnd),
    previousMonth: summarizePoolbarRows(rows, (d) => d >= prevStart && d <= prevEnd),
    allTime: summarizePoolbarRows(rows, () => true),
  };
}

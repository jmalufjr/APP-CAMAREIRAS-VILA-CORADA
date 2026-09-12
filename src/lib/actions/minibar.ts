"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toDateKey, nowInBrazil } from "@/lib/date";
import { getOrCreateCurrentBill } from "@/lib/room-bills";

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

// ---------- Camareira/admin: registrar consumo de frigobar na conta corrente do quarto ----------

export async function setMinibarConsumption(roomId: string, itemId: string, quantity: number) {
  const supabase = await createClient();

  const bill = await getOrCreateCurrentBill(supabase, roomId);
  if (bill.status === "fechada") {
    return { error: "A conta deste quarto está fechada. Não é possível registrar consumo." };
  }

  const { data: item } = await supabase.from("minibar_items").select("price").eq("id", itemId).single();
  if (!item) return { error: "Item de frigobar não encontrado." };

  const { error } = await supabase.from("room_bill_minibar_items").upsert(
    {
      bill_id: bill.id,
      minibar_item_id: itemId,
      quantity: Math.max(0, Math.floor(quantity)),
      price_snapshot: item.price,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bill_id,minibar_item_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  revalidatePath("/frigobar");
  return { success: true };
}

// ---------- Camareira: consumo de frigobar do quarto (tela de checklist) ----------

export interface MinibarRoomConsumption {
  billStatus: "aberta" | "fechada" | "reaberta" | "paga";
  items: { id: string; name: string; price: number; quantity: number }[];
}

export async function getMinibarConsumptionForRoom(roomId: string): Promise<MinibarRoomConsumption> {
  const supabase = await createClient();
  const bill = await getOrCreateCurrentBill(supabase, roomId);

  const [{ data: items }, { data: lines }] = await Promise.all([
    supabase.from("minibar_items").select("*").eq("active", true).order("position"),
    supabase.from("room_bill_minibar_items").select("minibar_item_id, quantity").eq("bill_id", bill.id),
  ]);

  const quantityByItem = new Map((lines ?? []).map((l) => [l.minibar_item_id, l.quantity]));

  return {
    billStatus: bill.status,
    items: (items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: quantityByItem.get(item.id) ?? 0,
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
      date: (r.room_bills.paid_at as string).slice(0, 10),
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

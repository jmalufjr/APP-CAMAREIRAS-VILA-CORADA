"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toDateKey, nowInBrazil, dateKeyInBrazil } from "@/lib/date";

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

// ---------- Relatórios: histórico (por período) e dashboard (mensal) ----------
// O consumo de bar agora vem das comandas (bar_comanda_items através de
// bar_comandas não canceladas), somado pela data em que a conta do quarto
// foi PAGA (paid_at) — mesmo critério já usado para o frigobar, já que o
// consumo não tem uma data própria (fica contra a conta corrente do quarto,
// que pode acumular comandas por vários dias até ser paga).

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
    .from("bar_comanda_items")
    .select(
      "quantity, price_snapshot, poolbar_items(name, category), bar_comandas!inner(status, room_bills!inner(status, paid_at))"
    )
    .neq("bar_comandas.status", "cancelada")
    .eq("bar_comandas.room_bills.status", "paga")
    .gt("quantity", 0);

  type Row = {
    quantity: number;
    price_snapshot: number;
    poolbar_items: { name: string; category: string | null } | null;
    bar_comandas: { status: string; room_bills: { status: string; paid_at: string | null } };
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.bar_comandas.room_bills.paid_at)
    .map((r) => ({
      quantity: r.quantity,
      price_snapshot: r.price_snapshot,
      name: r.poolbar_items?.name ?? "—",
      category: r.poolbar_items?.category ?? "Bebidas",
      // dateKeyInBrazil, não .slice(0,10): paid_at é um instante real
      // (timestamptz) — fatiar os 10 primeiros caracteres dá o dia em
      // UTC, que já é o dia seguinte pra pagamentos feitos entre 21h e
      // 23h59 em Brasília (UTC-3).
      date: dateKeyInBrazil(r.bar_comandas.room_bills.paid_at as string),
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

export interface PoolbarCategorySummary {
  items: PoolbarItemTotal[];
  total: number;
}

// Petiscos e bebidas contabilizados separadamente (Resumo Executivo) — as
// únicas duas categorias que poolbar_items usa na prática (ver seed);
// qualquer item sem categoria cai em "Bebidas" por segurança, pra nunca
// desaparecer de um total.
export interface PoolbarSplitSummary {
  petiscos: PoolbarCategorySummary;
  bebidas: PoolbarCategorySummary;
}

function splitByCategory(
  rows: { quantity: number; price_snapshot: number; name: string; category: string; date: string }[],
  filterFn: (date: string) => boolean
): PoolbarSplitSummary {
  return {
    petiscos: summarizePoolbarRows(
      rows.filter((r) => r.category === "Petiscos"),
      filterFn
    ),
    bebidas: summarizePoolbarRows(
      rows.filter((r) => r.category !== "Petiscos"),
      filterFn
    ),
  };
}

export interface PoolbarMonthlySummary {
  currentMonth: PoolbarSplitSummary;
  previousMonth: PoolbarSplitSummary;
  allTime: PoolbarSplitSummary;
}

export async function getPoolbarMonthlySummary(): Promise<PoolbarMonthlySummary> {
  const supabase = await createClient();
  const now = nowInBrazil();
  const currentStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const currentEnd = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
  const prevStart = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const prevEnd = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));

  const rows = await getPaidPoolbarRows(supabase);

  return {
    currentMonth: splitByCategory(rows, (d) => d >= currentStart && d <= currentEnd),
    previousMonth: splitByCategory(rows, (d) => d >= prevStart && d <= prevEnd),
    allTime: splitByCategory(rows, () => true),
  };
}

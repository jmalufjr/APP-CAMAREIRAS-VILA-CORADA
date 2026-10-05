"use server";

import { createClient } from "@/lib/supabase/server";
import { getPurchaseList } from "@/lib/actions/purchase-list";
import { nowInBrazil, toDateKey } from "@/lib/date";

function monthStartKey(): string {
  const now = nowInBrazil();
  return toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

export interface InventoryStockReportRow {
  inventory_item_id: string;
  item_name: string;
  unit: string;
  category_name: string;
  purchased_this_month: number;
  balance: number;
  estimated_days_remaining: number | null;
  needs_purchase: boolean;
}

// Relatório por item (ver PRD_compras.md): quanto foi comprado no mês,
// saldo atual, estimativa de dias restantes (saldo ÷ consumo médio
// diário, null quando não há giro calculado pra esse item) e se está na
// lista de compras agora — mesmo critério já usado em getPurchaseList.
export async function getInventoryStockReport(): Promise<InventoryStockReportRow[]> {
  const supabase = await createClient();
  const monthStart = monthStartKey();

  const [{ data: items }, { data: costItemLinks }, { data: suggestions }, { data: monthExpenseItems }, needingPurchase] =
    await Promise.all([
      supabase.from("inventory_items").select("id, name, unit, active").eq("active", true),
      supabase
        .from("cost_items")
        .select("inventory_item_id, cost_item_subcenters(cost_subcenters(name))")
        .eq("is_inventory", true)
        .not("inventory_item_id", "is", null),
      supabase.from("inventory_purchase_suggestions").select("inventory_item_id, balance, weekly_consumption"),
      supabase
        .from("expense_items")
        .select("quantity, cost_items(inventory_item_id), expenses!inner(date)")
        .not("cost_item_id", "is", null)
        .gte("expenses.date", monthStart),
      getPurchaseList(),
    ]);

  type ItemRaw = { id: string; name: string; unit: string };
  type SuggestionRaw = { inventory_item_id: string; balance: number; weekly_consumption: number };
  type ExpenseItemRaw = { quantity: number; cost_items: { inventory_item_id: string | null } | null };
  type CostItemLinkRaw = {
    inventory_item_id: string;
    cost_item_subcenters: { cost_subcenters: { name: string } | null }[];
  };

  const categoryNamesByItem = new Map<string, string[]>();
  ((costItemLinks ?? []) as unknown as CostItemLinkRaw[]).forEach((r) => {
    const names = categoryNamesByItem.get(r.inventory_item_id) ?? [];
    r.cost_item_subcenters.forEach((l) => {
      if (l.cost_subcenters?.name) names.push(l.cost_subcenters.name);
    });
    categoryNamesByItem.set(r.inventory_item_id, names);
  });

  const suggestionMap = new Map(((suggestions ?? []) as SuggestionRaw[]).map((s) => [s.inventory_item_id, s]));
  const needsPurchaseSet = new Set(needingPurchase.map((r) => r.inventory_item_id));

  const purchasedThisMonth = new Map<string, number>();
  ((monthExpenseItems ?? []) as unknown as ExpenseItemRaw[]).forEach((r) => {
    const invId = r.cost_items?.inventory_item_id;
    if (!invId) return;
    purchasedThisMonth.set(invId, (purchasedThisMonth.get(invId) ?? 0) + Number(r.quantity));
  });

  return ((items ?? []) as unknown as ItemRaw[])
    .map((item) => {
      const s = suggestionMap.get(item.id);
      const dailyConsumption = s ? s.weekly_consumption / 7 : 0;
      const categoryNames = categoryNamesByItem.get(item.id) ?? [];
      return {
        inventory_item_id: item.id,
        item_name: item.name,
        unit: item.unit,
        category_name: categoryNames.length > 0 ? categoryNames.join(" / ") : "—",
        purchased_this_month: purchasedThisMonth.get(item.id) ?? 0,
        balance: s?.balance ?? 0,
        estimated_days_remaining: dailyConsumption > 0 ? Math.floor((s?.balance ?? 0) / dailyConsumption) : null,
        needs_purchase: needsPurchaseSet.has(item.id),
      };
    })
    .sort((a, b) => a.category_name.localeCompare(b.category_name) || a.item_name.localeCompare(b.item_name));
}

export interface TopPurchasedItemRow {
  item_name: string;
  total_value: number;
}

// Os 20 itens com maior valor comprado — "no mês" ou "desde sempre" —
// pros dois gráficos de barra horizontal do Resumo Executivo.
export async function getTopPurchasedItems(period: "month" | "all", limit = 20): Promise<TopPurchasedItemRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("expense_items")
    .select("subtotal, cost_items!inner(inventory_items!inner(name)), expenses!inner(date)")
    .not("cost_item_id", "is", null);
  if (period === "month") query = query.gte("expenses.date", monthStartKey());

  const { data } = await query;
  type Raw = { subtotal: number; cost_items: { inventory_items: { name: string } | null } | null };

  const byItem = new Map<string, number>();
  ((data ?? []) as unknown as Raw[]).forEach((r) => {
    const name = r.cost_items?.inventory_items?.name;
    if (!name) return;
    byItem.set(name, (byItem.get(name) ?? 0) + Number(r.subtotal));
  });

  return Array.from(byItem.entries())
    .map(([item_name, total_value]) => ({ item_name, total_value }))
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, limit);
}

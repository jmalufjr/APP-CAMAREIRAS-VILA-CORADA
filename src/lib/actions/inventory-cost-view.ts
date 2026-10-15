"use server";

import { createClient } from "@/lib/supabase/server";

// "Itens de estoque e ciclo de compras" (ex-"Itens de estoque", Parte
// 21): listagem NÃO editável (a identidade/categoria vem do Plano de
// Contas — editar lá) — só "dias de folga" é editável aqui mesmo
// (ver updateInventoryItemCoverageDays em inventory-items.ts). Mostra a
// mesma divisão de centro/item do Plano de Contas (sem subcentro desde
// o Módulo Contábil Leva 1).
export interface InventoryItemWithCostPlan {
  inventory_item_id: string;
  name: string;
  unit: string;
  coverage_days: number;
  balance: number;
  reorder_point: number;
  center_names: string[];
}

export async function getInventoryItemsWithCostPlan(): Promise<InventoryItemWithCostPlan[]> {
  const supabase = await createClient();
  const [{ data: items }, { data: balances }, { data: links }] = await Promise.all([
    supabase.from("inventory_items").select("id, name, unit, coverage_days, reorder_point").eq("active", true),
    supabase.from("inventory_balances").select("inventory_item_id, balance"),
    supabase.from("cost_items").select("inventory_item_id, cost_item_centers(cost_centers(name))").eq("is_inventory", true),
  ]);

  const balanceMap = new Map((balances ?? []).map((b) => [b.inventory_item_id, Number(b.balance)]));

  type LinkRaw = { inventory_item_id: string; cost_item_centers: { cost_centers: { name: string } | null }[] };
  const centersByItem = new Map<string, string[]>();
  ((links ?? []) as unknown as LinkRaw[]).forEach((l) => {
    const centerNames = new Set<string>();
    l.cost_item_centers.forEach((cic) => {
      if (cic.cost_centers?.name) centerNames.add(cic.cost_centers.name);
    });
    centersByItem.set(l.inventory_item_id, Array.from(centerNames));
  });

  return (
    (items ?? []) as { id: string; name: string; unit: string; coverage_days: number; reorder_point: number }[]
  )
    .map((i) => ({
      inventory_item_id: i.id,
      name: i.name,
      unit: i.unit,
      coverage_days: i.coverage_days,
      reorder_point: Number(i.reorder_point),
      balance: balanceMap.get(i.id) ?? 0,
      center_names: centersByItem.get(i.id) ?? [],
    }))
    .sort((a, b) => (a.center_names[0] ?? "").localeCompare(b.center_names[0] ?? "") || a.name.localeCompare(b.name));
}

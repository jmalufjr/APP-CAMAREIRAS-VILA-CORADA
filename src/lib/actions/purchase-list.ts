"use server";

import { createClient } from "@/lib/supabase/server";
import { getAggregatedPurchaseRequests } from "@/lib/actions/purchase-requests";

export interface PurchaseListRow {
  inventory_item_id: string;
  item_name: string;
  unit: string;
  category_name: string;
  turnover_group_name: string | null;
  coverage_days: number | null;
  balance: number;
  weekly_consumption: number;
  // null = sem grupo de giro nem valor manual definido pelo admin — "sem
  // dado calculado", nunca confundir com "calculado e deu zero" (mesma
  // distinção já usada noutras partes do app).
  effective_reorder_point: number | null;
  suggested_qty_calculated: number;
  portion_weight_kg: number | null;
  suggested_qty_calculated_purchase_unit: number | null;
  requested_qty_team: number;
  requester_names: string[];
}

interface SuggestionRow {
  inventory_item_id: string;
  balance: number;
  weekly_consumption: number;
  coverage_days: number | null;
  calculated_reorder_point: number | null;
  manual_reorder_point: number;
  portion_weight_kg: number | null;
}

// Lista de compras do admin: mescla a sugestão calculada pelo sistema
// (giro semanal × dias de folga do grupo, com o valor manual do item
// como sobreposição quando definido — ver PRD_compras.md) com o total
// pedido visualmente pela equipe (camareira/manutenção). Um item aparece
// se tiver qualquer uma das duas coisas — nunca as duas obrigatoriamente.
export async function getPurchaseList(): Promise<PurchaseListRow[]> {
  const supabase = await createClient();

  const [{ data: items }, { data: suggestions }, teamRequests] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, unit, active, expense_categories(name), inventory_turnover_groups(name)")
      .eq("active", true),
    supabase.from("inventory_purchase_suggestions").select("*"),
    getAggregatedPurchaseRequests(),
  ]);

  type ItemRaw = {
    id: string;
    name: string;
    unit: string;
    expense_categories: { name: string } | null;
    inventory_turnover_groups: { name: string } | null;
  };
  const itemRows = (items ?? []) as unknown as ItemRaw[];
  const suggestionMap = new Map(
    ((suggestions ?? []) as unknown as SuggestionRow[]).map((s) => [s.inventory_item_id, s])
  );
  const requestMap = new Map(teamRequests.map((r) => [r.inventory_item_id, r]));

  const rows: PurchaseListRow[] = itemRows.map((item) => {
    const s = suggestionMap.get(item.id);
    const request = requestMap.get(item.id);

    const manual = s && s.manual_reorder_point > 0 ? s.manual_reorder_point : null;
    const effective_reorder_point = manual ?? s?.calculated_reorder_point ?? null;
    const suggested_qty_calculated =
      effective_reorder_point !== null ? Math.max(0, effective_reorder_point - (s?.balance ?? 0)) : 0;
    const portion_weight_kg = s?.portion_weight_kg ?? null;

    return {
      inventory_item_id: item.id,
      item_name: item.name,
      unit: item.unit,
      category_name: item.expense_categories?.name ?? "—",
      turnover_group_name: item.inventory_turnover_groups?.name ?? null,
      coverage_days: s?.coverage_days ?? null,
      balance: s?.balance ?? 0,
      weekly_consumption: s?.weekly_consumption ?? 0,
      effective_reorder_point,
      suggested_qty_calculated,
      portion_weight_kg,
      suggested_qty_calculated_purchase_unit:
        portion_weight_kg !== null ? suggested_qty_calculated * portion_weight_kg : null,
      requested_qty_team: request?.total_qty ?? 0,
      requester_names: request?.requester_names ?? [],
    };
  });

  return rows
    .filter((r) => r.requested_qty_team > 0 || r.suggested_qty_calculated > 0)
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}

// Versão enxuta, só pra contar quantos itens precisam de atenção — usada
// no aviso do Resumo Executivo e no hub de Compras (evita buscar/montar a
// lista inteira só pra mostrar um número).
export async function getItemsNeedingPurchaseCount(): Promise<number> {
  const list = await getPurchaseList();
  return list.length;
}

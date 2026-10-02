"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAggregatedPurchaseRequests } from "@/lib/actions/purchase-requests";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/dashboard");
}

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
  // true quando o admin dispensou essa sugestão E o saldo não mudou desde
  // então — nesse caso o item não entra na lista por causa dela (só por
  // um eventual pedido da equipe). Volta a false sozinho assim que o
  // saldo mudar de novo (nova compra ou novo consumo).
  calculated_dismissed: boolean;
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

interface DismissalRow {
  inventory_item_id: string;
  dismissed_balance: number;
}

async function getActiveDismissalsMap(): Promise<Map<string, DismissalRow>> {
  const supabase = await createClient();
  const { data } = await supabase.from("inventory_suggestion_dismissals").select("inventory_item_id, dismissed_balance");
  return new Map(((data ?? []) as DismissalRow[]).map((d) => [d.inventory_item_id, d]));
}

// Lista de compras do admin: mescla a sugestão calculada pelo sistema
// (giro semanal × dias de folga do grupo, com o valor manual do item
// como sobreposição quando definido — ver PRD_compras.md) com o total
// pedido visualmente pela equipe (camareira/manutenção). Um item aparece
// se tiver qualquer uma das duas coisas — nunca as duas obrigatoriamente.
export async function getPurchaseList(): Promise<PurchaseListRow[]> {
  const supabase = await createClient();

  const [{ data: items }, { data: suggestions }, teamRequests, dismissals] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, unit, active, expense_categories(name), inventory_turnover_groups(name)")
      .eq("active", true),
    supabase.from("inventory_purchase_suggestions").select("*"),
    getAggregatedPurchaseRequests(),
    getActiveDismissalsMap(),
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
    const dismissal = dismissals.get(item.id);

    const manual = s && s.manual_reorder_point > 0 ? s.manual_reorder_point : null;
    const effective_reorder_point = manual ?? s?.calculated_reorder_point ?? null;
    const balance = s?.balance ?? 0;
    const suggested_qty_calculated =
      effective_reorder_point !== null ? Math.max(0, effective_reorder_point - balance) : 0;
    const portion_weight_kg = s?.portion_weight_kg ?? null;
    const calculated_dismissed = dismissal !== undefined && dismissal.dismissed_balance === balance;

    return {
      inventory_item_id: item.id,
      item_name: item.name,
      unit: item.unit,
      category_name: item.expense_categories?.name ?? "—",
      turnover_group_name: item.inventory_turnover_groups?.name ?? null,
      coverage_days: s?.coverage_days ?? null,
      balance,
      weekly_consumption: s?.weekly_consumption ?? 0,
      effective_reorder_point,
      suggested_qty_calculated,
      calculated_dismissed,
      portion_weight_kg,
      suggested_qty_calculated_purchase_unit:
        portion_weight_kg !== null ? suggested_qty_calculated * portion_weight_kg : null,
      requested_qty_team: request?.total_qty ?? 0,
      requester_names: request?.requester_names ?? [],
    };
  });

  return rows
    .filter((r) => r.requested_qty_team > 0 || (r.suggested_qty_calculated > 0 && !r.calculated_dismissed))
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}

// Versão enxuta, só pra contar quantos itens precisam de atenção — usada
// no aviso do Resumo Executivo e no hub de Compras (evita buscar/montar a
// lista inteira só pra mostrar um número).
export async function getItemsNeedingPurchaseCount(): Promise<number> {
  const list = await getPurchaseList();
  return list.length;
}

// Dispensa a sugestão CALCULADA de um item (diferente de cancelar o
// pedido da equipe, que já existia) — guarda o saldo atual; a dispensa só
// vale enquanto esse saldo não mudar de novo (ver getPurchaseList).
export async function dismissCalculatedSuggestion(inventoryItemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: balanceRow } = await supabase
    .from("inventory_balances")
    .select("balance")
    .eq("inventory_item_id", inventoryItemId)
    .maybeSingle();
  const currentBalance = Number(balanceRow?.balance ?? 0);

  const { error } = await supabase.from("inventory_suggestion_dismissals").upsert({
    inventory_item_id: inventoryItemId,
    dismissed_balance: currentBalance,
    dismissed_by: user.id,
    dismissed_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function reactivateCalculatedSuggestion(inventoryItemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_suggestion_dismissals").delete().eq("inventory_item_id", inventoryItemId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export interface DismissedSuggestionRow {
  inventory_item_id: string;
  item_name: string;
  unit: string;
  dismissed_at: string;
  dismissed_by_name: string | null;
}

// Só os itens com dispensa ATIVA (saldo não mudou desde a dispensa) —
// mostrado numa seção à parte em "Lista de compras", com botão "Reativar".
export async function getActiveDismissedSuggestions(): Promise<DismissedSuggestionRow[]> {
  const supabase = await createClient();
  const [{ data: dismissals }, { data: balances }] = await Promise.all([
    supabase
      .from("inventory_suggestion_dismissals")
      .select("inventory_item_id, dismissed_balance, dismissed_at, inventory_items(name, unit), profiles(name)"),
    supabase.from("inventory_balances").select("inventory_item_id, balance"),
  ]);

  type Raw = {
    inventory_item_id: string;
    dismissed_balance: number;
    dismissed_at: string;
    inventory_items: { name: string; unit: string } | null;
    profiles: { name: string } | null;
  };
  const balanceMap = new Map((balances ?? []).map((b) => [b.inventory_item_id, Number(b.balance)]));

  return ((dismissals ?? []) as unknown as Raw[])
    .filter((d) => (balanceMap.get(d.inventory_item_id) ?? 0) === Number(d.dismissed_balance))
    .map((d) => ({
      inventory_item_id: d.inventory_item_id,
      item_name: d.inventory_items?.name ?? "—",
      unit: d.inventory_items?.unit ?? "un",
      dismissed_at: d.dismissed_at,
      dismissed_by_name: d.profiles?.name ?? null,
    }))
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}

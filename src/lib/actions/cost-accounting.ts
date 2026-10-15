"use server";

import { createClient } from "@/lib/supabase/server";
import { weightedAverageUnitCost, computeDishCost } from "@/lib/cost-accounting";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Diárias ocupadas no período — mesma fonte/fallback já usado pela
// comissão de café da manhã (Parte 27 do app principal).
export async function getOccupiedRoomNightsForPeriod(from: string, to: string): Promise<number> {
  const supabase = await createClient();
  const [{ data: eligibility }, { data: roomAssignments }] = await Promise.all([
    supabase.from("daily_breakfast_settings").select("date, eligible_suites_count").gte("date", from).lte("date", to),
    supabase.from("daily_breakfast_room_assignments").select("date, room_id").gte("date", from).lte("date", to),
  ]);

  const fallbackByDate = new Map<string, number>();
  (roomAssignments ?? []).forEach((r) => {
    fallbackByDate.set(r.date, (fallbackByDate.get(r.date) ?? 0) + 1);
  });
  const eligibilityByDate = new Map((eligibility ?? []).map((e) => [e.date, e.eligible_suites_count as number | null]));
  const allDates = new Set<string>([...eligibilityByDate.keys(), ...fallbackByDate.keys()]);

  let total = 0;
  allDates.forEach((date) => {
    const eligible = eligibilityByDate.get(date);
    total += eligible !== undefined && eligible !== null ? eligible : fallbackByDate.get(date) ?? 0;
  });
  return total;
}

async function getBreakfastGuestNightsForPeriod(supabase: Supabase, from: string, to: string): Promise<number> {
  const { data } = await supabase.from("daily_breakfast_room_assignments").select("guest_count").gte("date", from).lte("date", to);
  return (data ?? []).reduce((sum, r) => sum + Number(r.guest_count), 0);
}

interface ExpenseItemCostRow {
  cost_item_id: string;
  subtotal: number;
}

// Gasto total por item de custo no período (soma simples de subtotal —
// bem mais direto que antes, já que a linha agora liga direto no item de
// custo, sem precisar resolver categoria via item de estoque).
async function getSpendByCostItem(supabase: Supabase, from: string, to: string): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("expense_items")
    .select("cost_item_id, subtotal, expenses!inner(date)")
    .not("cost_item_id", "is", null)
    .gte("expenses.date", from)
    .lte("expenses.date", to);

  const map = new Map<string, number>();
  ((data ?? []) as unknown as ExpenseItemCostRow[]).forEach((r) => {
    map.set(r.cost_item_id, (map.get(r.cost_item_id) ?? 0) + Number(r.subtotal));
  });
  return map;
}

interface ItemCenterLink {
  cost_item_id: string;
  center_id: string;
  alloc_pct: number;
}

export interface CenterTotal {
  center_id: string;
  center_name: string;
  total: number;
}

export interface CostItemBreakdownRow {
  cost_item_id: string;
  cost_item_name: string;
  total_spend: number;
  // Contribuição desse item em cada centro (já em R$, não %).
  by_center: { center_id: string; center_name: string; amount: number }[];
}

export interface CostCentersSummary {
  centerTotals: CenterTotal[];
  breakdown: CostItemBreakdownRow[];
}

// Núcleo do módulo de custos: rateia o gasto de cada item de custo pelos
// centros a que pertence (% do item), direto — sempre pelos percentuais
// cadastrados no Plano de Contas (nunca fixo no código, pra se
// atualizar sozinho quando o admin editar um percentual). Até o Módulo
// Contábil Leva 1, havia uma camada extra de subcentro no meio (2
// cascatas); removida — ver PRD_compras&contabil.md seção 22.3 item 2.
export async function getCostCentersSummaryForPeriod(from: string, to: string): Promise<CostCentersSummary> {
  const supabase = await createClient();
  const [spendByItem, { data: items }, { data: itemLinks }] = await Promise.all([
    getSpendByCostItem(supabase, from, to),
    supabase.from("cost_items").select("id, name"),
    supabase.from("cost_item_centers").select("cost_item_id, center_id, alloc_pct, cost_centers(name)"),
  ]);

  const itemNameById = new Map(((items ?? []) as { id: string; name: string }[]).map((i) => [i.id, i.name]));

  type LinkRaw = ItemCenterLink & { cost_centers: { name: string } | null };
  const linksByItem = new Map<string, LinkRaw[]>();
  const centerNameById = new Map<string, string>();
  ((itemLinks ?? []) as unknown as LinkRaw[]).forEach((l) => {
    const list = linksByItem.get(l.cost_item_id) ?? [];
    list.push(l);
    linksByItem.set(l.cost_item_id, list);
    if (l.cost_centers?.name) centerNameById.set(l.center_id, l.cost_centers.name);
  });

  const centerTotalsMap = new Map<string, number>();
  const breakdown: CostItemBreakdownRow[] = [];

  spendByItem.forEach((totalSpend, costItemId) => {
    const links = linksByItem.get(costItemId) ?? [];
    const byCenter: CostItemBreakdownRow["by_center"] = [];

    links.forEach((il) => {
      const amountAtCenter = totalSpend * (il.alloc_pct / 100);
      centerTotalsMap.set(il.center_id, (centerTotalsMap.get(il.center_id) ?? 0) + amountAtCenter);
      byCenter.push({
        center_id: il.center_id,
        center_name: centerNameById.get(il.center_id) ?? "—",
        amount: amountAtCenter,
      });
    });

    breakdown.push({
      cost_item_id: costItemId,
      cost_item_name: itemNameById.get(costItemId) ?? "—",
      total_spend: totalSpend,
      by_center: byCenter,
    });
  });

  const centerTotals: CenterTotal[] = Array.from(centerTotalsMap.entries())
    .map(([center_id, total]) => ({ center_id, center_name: centerNameById.get(center_id) ?? "—", total }))
    .sort((a, b) => b.total - a.total);

  return { centerTotals, breakdown: breakdown.sort((a, b) => b.total_spend - a.total_spend) };
}

async function getWeightedAverageCosts(supabase: Supabase, from: string, to: string): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("expense_items")
    .select("quantity, subtotal, cost_items(inventory_item_id), expenses!inner(date)")
    .not("cost_item_id", "is", null)
    .gte("expenses.date", from)
    .lte("expenses.date", to);

  type Raw = { quantity: number; subtotal: number; cost_items: { inventory_item_id: string | null } | null };
  const rowsByInventoryItem = new Map<string, { subtotal: number; quantity: number }[]>();
  ((data ?? []) as unknown as Raw[]).forEach((r) => {
    const invId = r.cost_items?.inventory_item_id;
    if (!invId) return;
    const list = rowsByInventoryItem.get(invId) ?? [];
    list.push({ subtotal: Number(r.subtotal), quantity: Number(r.quantity) });
    rowsByInventoryItem.set(invId, list);
  });

  const result = new Map<string, number>();
  rowsByInventoryItem.forEach((rows, invId) => {
    const avg = weightedAverageUnitCost(rows);
    if (avg !== null) result.set(invId, avg);
  });
  return result;
}

export interface DishCostRow {
  dish_id: string;
  dish_name: string;
  kind: "minibar" | "poolbar";
  unit_cost: number;
  has_recipe: boolean;
}

// Custo de 1 porção de cada prato do cardápio no período, pela ficha
// técnica × custo médio dos ingredientes no período.
export async function getDishCostsForPeriod(from: string, to: string): Promise<DishCostRow[]> {
  const supabase = await createClient();
  const [avgCosts, { data: poolbar }, { data: minibar }, { data: recipes }] = await Promise.all([
    getWeightedAverageCosts(supabase, from, to),
    supabase.from("poolbar_items").select("id, name").order("name"),
    supabase.from("minibar_items").select("id, name").order("name"),
    supabase.from("inventory_item_recipes").select("inventory_item_id, minibar_item_id, poolbar_item_id, portions_count, amount_per_portion"),
  ]);

  type RecipeRow = {
    inventory_item_id: string;
    minibar_item_id: string | null;
    poolbar_item_id: string | null;
    portions_count: number;
    amount_per_portion: number;
  };
  const recipeRows = (recipes ?? []) as unknown as RecipeRow[];

  function dishCost(kind: "minibar" | "poolbar", id: string): { cost: number; hasRecipe: boolean } {
    const matches = recipeRows.filter((r) => (kind === "minibar" ? r.minibar_item_id === id : r.poolbar_item_id === id));
    if (matches.length === 0) return { cost: 0, hasRecipe: false };
    const cost = computeDishCost(
      matches.map((m) => ({
        portions_count: Number(m.portions_count),
        amount_per_portion: Number(m.amount_per_portion),
        avgUnitCost: avgCosts.get(m.inventory_item_id) ?? null,
      }))
    );
    return { cost, hasRecipe: true };
  }

  const rows: DishCostRow[] = [];
  ((poolbar ?? []) as { id: string; name: string }[]).forEach((p) => {
    const { cost, hasRecipe } = dishCost("poolbar", p.id);
    rows.push({ dish_id: p.id, dish_name: p.name, kind: "poolbar", unit_cost: cost, has_recipe: hasRecipe });
  });
  ((minibar ?? []) as { id: string; name: string }[]).forEach((m) => {
    const { cost, hasRecipe } = dishCost("minibar", m.id);
    rows.push({ dish_id: m.id, dish_name: m.name, kind: "minibar", unit_cost: cost, has_recipe: hasRecipe });
  });
  return rows;
}

export interface BreakfastCostSummary {
  totalSpend: number;
  guestNights: number;
  costPerGuest: number | null;
  byItem: { label: string; total: number }[];
}

// Custo do café da manhã no período: usa o mesmo total do centro "Café
// da manhã" já calculado pela cascata (consistente com o card principal
// de Custos), dividido pelos hóspedes-noite; detalhado por item de custo
// (agrupando pelo cost_report_group do item de estoque por trás, quando
// houver — ex.: "Frutas e ovos").
export async function getBreakfastCostForPeriod(from: string, to: string, summary: CostCentersSummary): Promise<BreakfastCostSummary> {
  const supabase = await createClient();
  const guestNights = await getBreakfastGuestNightsForPeriod(supabase, from, to);
  const totalSpend = summary.centerTotals.find((c) => c.center_name === "Café da manhã")?.total ?? 0;

  const costItemIds = [...new Set(summary.breakdown.flatMap((b) => (b.by_center.some((s) => s.center_name === "Café da manhã") ? [b.cost_item_id] : [])))];
  const { data: items } = costItemIds.length
    ? await supabase.from("cost_items").select("id, name, inventory_item_id, inventory_items(cost_report_group)").in("id", costItemIds)
    : { data: [] };
  type Raw = { id: string; name: string; inventory_items: { cost_report_group: string | null } | null };
  const labelByItem = new Map(
    ((items ?? []) as unknown as Raw[]).map((i) => [i.id, i.inventory_items?.cost_report_group || i.name])
  );

  const byLabel = new Map<string, number>();
  summary.breakdown.forEach((b) => {
    const amount = b.by_center.filter((s) => s.center_name === "Café da manhã").reduce((sum, s) => sum + s.amount, 0);
    if (amount === 0) return;
    const label = labelByItem.get(b.cost_item_id) ?? b.cost_item_name;
    byLabel.set(label, (byLabel.get(label) ?? 0) + amount);
  });

  return {
    totalSpend,
    guestNights,
    costPerGuest: guestNights > 0 ? totalSpend / guestNights : null,
    byItem: Array.from(byLabel.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total),
  };
}

export interface DemonstrativoMonthRow {
  month: string;
  center_name: string;
  total: number;
}

// Demonstrativo de Despesas: gasto por CENTRO de custo, mês a mês — nunca
// persiste nada, só lê a categorização atual de cada item a cada
// carregamento, por isso reagrupa sozinho quando o Plano de Contas é
// editado.
export async function getExpenseDemonstrativoForPeriod(from: string, to: string): Promise<DemonstrativoMonthRow[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("expense_items")
    .select("cost_item_id, fixed_asset_id, subtotal, expenses!inner(date)")
    .gte("expenses.date", from)
    .lte("expenses.date", to);

  type Raw = { cost_item_id: string | null; fixed_asset_id: string | null; subtotal: number; expenses: { date: string } };
  const itemRows = (rows ?? []) as unknown as Raw[];
  const costItemIds = [...new Set(itemRows.filter((r) => r.cost_item_id).map((r) => r.cost_item_id as string))];

  const { data: itemLinks } = costItemIds.length
    ? await supabase.from("cost_item_centers").select("cost_item_id, center_id, alloc_pct, cost_centers(name)").in("cost_item_id", costItemIds)
    : { data: [] };

  type LinkRaw = { cost_item_id: string; center_id: string; alloc_pct: number; cost_centers: { name: string } | null };
  const linksByItem = new Map<string, LinkRaw[]>();
  ((itemLinks ?? []) as unknown as LinkRaw[]).forEach((l) => {
    const list = linksByItem.get(l.cost_item_id) ?? [];
    list.push(l);
    linksByItem.set(l.cost_item_id, list);
  });

  const totals = new Map<string, number>(); // key = `${month}__${center_name}`
  itemRows.forEach((r) => {
    const month = r.expenses.date.slice(0, 7);
    if (r.fixed_asset_id) return; // ativo permanente nunca é custo do período
    if (!r.cost_item_id) {
      const key = `${month}__Sem categoria`;
      totals.set(key, (totals.get(key) ?? 0) + Number(r.subtotal));
      return;
    }
    const itemLinksForRow = linksByItem.get(r.cost_item_id) ?? [];
    if (itemLinksForRow.length === 0) {
      const key = `${month}__Sem categoria`;
      totals.set(key, (totals.get(key) ?? 0) + Number(r.subtotal));
      return;
    }
    itemLinksForRow.forEach((il) => {
      const amountAtCenter = Number(r.subtotal) * (il.alloc_pct / 100);
      const key = `${month}__${il.cost_centers?.name ?? "—"}`;
      totals.set(key, (totals.get(key) ?? 0) + amountAtCenter);
    });
  });

  return Array.from(totals.entries())
    .map(([key, total]) => {
      const [month, center_name] = key.split("__");
      return { month, center_name, total };
    })
    .sort((a, b) => (a.month === b.month ? a.center_name.localeCompare(b.center_name) : b.month.localeCompare(a.month)));
}

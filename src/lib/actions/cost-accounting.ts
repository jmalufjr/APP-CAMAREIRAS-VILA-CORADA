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

interface ItemSubcenterLink {
  cost_item_id: string;
  subcenter_id: string;
  alloc_pct: number;
}
interface SubcenterCenterLink {
  subcenter_id: string;
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
  // Contribuição desse item em cada subcentro (já em R$, não %).
  by_subcenter: { subcenter_id: string; subcenter_name: string; center_id: string; center_name: string; amount: number }[];
}

export interface CostCentersSummary {
  centerTotals: CenterTotal[];
  breakdown: CostItemBreakdownRow[];
}

// Núcleo do módulo de custos: rateia o gasto de cada item de custo pelos
// subcentros a que pertence (% do item), depois rateia cada subcentro
// pelos centros a que pertence (% do subcentro) — 2 cascatas, sempre
// pelos percentuais cadastrados no Plano de Contas (nunca fixo no
// código, pra se atualizar sozinho quando o admin editar um percentual).
export async function getCostCentersSummaryForPeriod(from: string, to: string): Promise<CostCentersSummary> {
  const supabase = await createClient();
  const [spendByItem, { data: items }, { data: itemLinks }, { data: subcenterLinks }] = await Promise.all([
    getSpendByCostItem(supabase, from, to),
    supabase.from("cost_items").select("id, name"),
    supabase.from("cost_item_subcenters").select("cost_item_id, subcenter_id, alloc_pct"),
    supabase.from("cost_subcenter_centers").select("subcenter_id, center_id, alloc_pct, cost_subcenters(name), cost_centers(name)"),
  ]);

  const itemNameById = new Map(((items ?? []) as { id: string; name: string }[]).map((i) => [i.id, i.name]));

  type SubcenterCenterRaw = SubcenterCenterLink & { cost_subcenters: { name: string } | null; cost_centers: { name: string } | null };
  const subcenterCenterLinksBySubcenter = new Map<string, SubcenterCenterRaw[]>();
  const subcenterNameById = new Map<string, string>();
  const centerNameById = new Map<string, string>();
  ((subcenterLinks ?? []) as unknown as SubcenterCenterRaw[]).forEach((l) => {
    const list = subcenterCenterLinksBySubcenter.get(l.subcenter_id) ?? [];
    list.push(l);
    subcenterCenterLinksBySubcenter.set(l.subcenter_id, list);
    if (l.cost_subcenters?.name) subcenterNameById.set(l.subcenter_id, l.cost_subcenters.name);
    if (l.cost_centers?.name) centerNameById.set(l.center_id, l.cost_centers.name);
  });

  const itemLinksByItem = new Map<string, ItemSubcenterLink[]>();
  ((itemLinks ?? []) as ItemSubcenterLink[]).forEach((l) => {
    const list = itemLinksByItem.get(l.cost_item_id) ?? [];
    list.push(l);
    itemLinksByItem.set(l.cost_item_id, list);
  });

  const centerTotalsMap = new Map<string, number>();
  const breakdown: CostItemBreakdownRow[] = [];

  spendByItem.forEach((totalSpend, costItemId) => {
    const links = itemLinksByItem.get(costItemId) ?? [];
    const bySubcenter: CostItemBreakdownRow["by_subcenter"] = [];

    links.forEach((il) => {
      const amountAtSubcenter = totalSpend * (il.alloc_pct / 100);
      const centerLinks = subcenterCenterLinksBySubcenter.get(il.subcenter_id) ?? [];
      centerLinks.forEach((cl) => {
        const amountAtCenter = amountAtSubcenter * (cl.alloc_pct / 100);
        centerTotalsMap.set(cl.center_id, (centerTotalsMap.get(cl.center_id) ?? 0) + amountAtCenter);
        bySubcenter.push({
          subcenter_id: il.subcenter_id,
          subcenter_name: subcenterNameById.get(il.subcenter_id) ?? "—",
          center_id: cl.center_id,
          center_name: centerNameById.get(cl.center_id) ?? "—",
          amount: amountAtCenter,
        });
      });
    });

    breakdown.push({
      cost_item_id: costItemId,
      cost_item_name: itemNameById.get(costItemId) ?? "—",
      total_spend: totalSpend,
      by_subcenter: bySubcenter,
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

  const costItemIds = [...new Set(summary.breakdown.flatMap((b) => (b.by_subcenter.some((s) => s.center_name === "Café da manhã") ? [b.cost_item_id] : [])))];
  const { data: items } = costItemIds.length
    ? await supabase.from("cost_items").select("id, name, inventory_item_id, inventory_items(cost_report_group)").in("id", costItemIds)
    : { data: [] };
  type Raw = { id: string; name: string; inventory_items: { cost_report_group: string | null } | null };
  const labelByItem = new Map(
    ((items ?? []) as unknown as Raw[]).map((i) => [i.id, i.inventory_items?.cost_report_group || i.name])
  );

  const byLabel = new Map<string, number>();
  summary.breakdown.forEach((b) => {
    const amount = b.by_subcenter.filter((s) => s.center_name === "Café da manhã").reduce((sum, s) => sum + s.amount, 0);
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

  const [{ data: itemLinks }, { data: subcenterLinks }] = await Promise.all([
    costItemIds.length
      ? supabase.from("cost_item_subcenters").select("cost_item_id, subcenter_id, alloc_pct").in("cost_item_id", costItemIds)
      : Promise.resolve({ data: [] as { cost_item_id: string; subcenter_id: string; alloc_pct: number }[] }),
    supabase.from("cost_subcenter_centers").select("subcenter_id, center_id, alloc_pct, cost_centers(name)"),
  ]);

  type SubRaw = { subcenter_id: string; center_id: string; alloc_pct: number; cost_centers: { name: string } | null };
  const centerLinksBySubcenter = new Map<string, SubRaw[]>();
  ((subcenterLinks ?? []) as unknown as SubRaw[]).forEach((l) => {
    const list = centerLinksBySubcenter.get(l.subcenter_id) ?? [];
    list.push(l);
    centerLinksBySubcenter.set(l.subcenter_id, list);
  });
  const itemLinksByItem = new Map<string, { subcenter_id: string; alloc_pct: number }[]>();
  (itemLinks ?? []).forEach((l) => {
    const list = itemLinksByItem.get(l.cost_item_id) ?? [];
    list.push({ subcenter_id: l.subcenter_id, alloc_pct: l.alloc_pct });
    itemLinksByItem.set(l.cost_item_id, list);
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
    const itemLinksForRow = itemLinksByItem.get(r.cost_item_id) ?? [];
    if (itemLinksForRow.length === 0) {
      const key = `${month}__Sem categoria`;
      totals.set(key, (totals.get(key) ?? 0) + Number(r.subtotal));
      return;
    }
    itemLinksForRow.forEach((il) => {
      const amountAtSubcenter = Number(r.subtotal) * (il.alloc_pct / 100);
      const centerLinks = centerLinksBySubcenter.get(il.subcenter_id) ?? [];
      centerLinks.forEach((cl) => {
        const amountAtCenter = amountAtSubcenter * (cl.alloc_pct / 100);
        const key = `${month}__${cl.cost_centers?.name ?? "—"}`;
        totals.set(key, (totals.get(key) ?? 0) + amountAtCenter);
      });
    });
  });

  return Array.from(totals.entries())
    .map(([key, total]) => {
      const [month, center_name] = key.split("__");
      return { month, center_name, total };
    })
    .sort((a, b) => (a.month === b.month ? a.center_name.localeCompare(b.center_name) : b.month.localeCompare(a.month)));
}

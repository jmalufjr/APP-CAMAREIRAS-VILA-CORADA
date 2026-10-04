"use server";

import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/lib/types";
import {
  type CostCenter,
  allocateFixedCost,
  emptyCostCenterTotals,
  addCostCenterTotals,
  weightedAverageUnitCost,
  computeDishCost,
} from "@/lib/cost-accounting";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Diárias ocupadas no período — mesma fonte/fallback já usado pela
// comissão de café da manhã (Parte 27 do app principal): soma
// `eligible_suites_count` quando a sincronização já gravou (cada suíte
// elegível = 1 diária ocupada naquele dia), com fallback pra contar
// linhas de `daily_breakfast_room_assignments` em datas sem esse valor.
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

  const eligibilityByDate = new Map(
    (eligibility ?? []).map((e) => [e.date, e.eligible_suites_count as number | null])
  );
  const allDates = new Set<string>([...eligibilityByDate.keys(), ...fallbackByDate.keys()]);

  let total = 0;
  allDates.forEach((date) => {
    const eligible = eligibilityByDate.get(date);
    total += eligible !== undefined && eligible !== null ? eligible : fallbackByDate.get(date) ?? 0;
  });
  return total;
}

// Hóspedes-noite de café da manhã no período — soma de guest_count das
// alocações de mesa do café (cada suíte alocada numa noite = aqueles
// hóspedes tomando café naquela noite).
async function getBreakfastGuestNightsForPeriod(supabase: Supabase, from: string, to: string): Promise<number> {
  const { data } = await supabase.from("daily_breakfast_room_assignments").select("guest_count").gte("date", from).lte("date", to);
  return (data ?? []).reduce((sum, r) => sum + Number(r.guest_count), 0);
}

interface ExpenseItemRow {
  inventory_item_id: string | null;
  category_id: string | null;
  subtotal: number;
}

// Todas as linhas de despesa (expense_items) do período, com data já
// filtrada via o join com expenses — base de tudo neste módulo.
async function getExpenseItemRowsForPeriod(supabase: Supabase, from: string, to: string): Promise<ExpenseItemRow[]> {
  const { data } = await supabase
    .from("expense_items")
    .select("inventory_item_id, category_id, subtotal, expenses!inner(date)")
    .gte("expenses.date", from)
    .lte("expenses.date", to);
  return (data ?? []) as unknown as ExpenseItemRow[];
}

// Gasto total por categoria no período — combina linhas ligadas a item de
// estoque (categoria vem das categorias do item, Parte 19 — um item em 2
// categorias soma o subtotal nas duas, mesma convenção já usada em
// getExpenseSummaryByCategory) com linhas sem item (categoria vem direto
// da própria linha — Parte 20, cobre salário/luz/honorários).
async function getCategorySpendMap(supabase: Supabase, from: string, to: string): Promise<Map<string, number>> {
  const rows = await getExpenseItemRowsForPeriod(supabase, from, to);

  const itemIds = [...new Set(rows.filter((r) => r.inventory_item_id).map((r) => r.inventory_item_id as string))];
  const { data: links } = itemIds.length
    ? await supabase.from("inventory_item_categories").select("inventory_item_id, category_id").in("inventory_item_id", itemIds)
    : { data: [] as { inventory_item_id: string; category_id: string }[] };
  const categoriesByItem = new Map<string, string[]>();
  (links ?? []).forEach((l) => {
    const list = categoriesByItem.get(l.inventory_item_id) ?? [];
    list.push(l.category_id);
    categoriesByItem.set(l.inventory_item_id, list);
  });

  const spend = new Map<string, number>();
  rows.forEach((r) => {
    const categoryIds = r.inventory_item_id ? categoriesByItem.get(r.inventory_item_id) ?? [] : r.category_id ? [r.category_id] : [];
    categoryIds.forEach((catId) => spend.set(catId, (spend.get(catId) ?? 0) + Number(r.subtotal)));
  });
  return spend;
}

// Custo médio ponderado de cada item de estoque no período (ver
// weightedAverageUnitCost em cost-accounting.ts) — base pro custo de
// prato e pro detalhamento do café da manhã por item.
async function getWeightedAverageCosts(supabase: Supabase, from: string, to: string): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("expense_items")
    .select("inventory_item_id, quantity, subtotal, expenses!inner(date)")
    .not("inventory_item_id", "is", null)
    .gte("expenses.date", from)
    .lte("expenses.date", to);

  const rowsByItem = new Map<string, { subtotal: number; quantity: number }[]>();
  ((data ?? []) as unknown as { inventory_item_id: string; quantity: number; subtotal: number }[]).forEach((r) => {
    const list = rowsByItem.get(r.inventory_item_id) ?? [];
    list.push({ subtotal: Number(r.subtotal), quantity: Number(r.quantity) });
    rowsByItem.set(r.inventory_item_id, list);
  });

  const result = new Map<string, number>();
  rowsByItem.forEach((rows, itemId) => {
    const avg = weightedAverageUnitCost(rows);
    if (avg !== null) result.set(itemId, avg);
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

// Custo de 1 porção de cada prato do cardápio (bar da piscina/frigobar)
// no período, pela ficha técnica × custo médio dos ingredientes no
// período — pratos sem nenhuma ficha técnica cadastrada aparecem com
// has_recipe=false (não é custo zero de verdade, é "ainda não
// configurado", ver tela "Lista de pratos").
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

// Custo do café da manhã no período: gasto total da categoria "Café da
// manhã" ÷ hóspedes-noite servidos, e o mesmo gasto detalhado por item
// (agrupando itens com o mesmo cost_report_group — ex.: "Frutas e ovos"
// — numa linha só, já que não há controle fino de estoque sobre eles).
export async function getBreakfastCostForPeriod(from: string, to: string): Promise<BreakfastCostSummary> {
  const supabase = await createClient();
  const [{ data: category }, guestNights] = await Promise.all([
    supabase.from("expense_categories").select("id").eq("name", "Café da manhã").maybeSingle(),
    getBreakfastGuestNightsForPeriod(supabase, from, to),
  ]);
  if (!category) return { totalSpend: 0, guestNights, costPerGuest: null, byItem: [] };

  const { data: items } = await supabase
    .from("expense_items")
    .select("subtotal, inventory_item_id, inventory_items(name, cost_report_group), expenses!inner(date)")
    .gte("expenses.date", from)
    .lte("expenses.date", to);

  type Raw = {
    subtotal: number;
    inventory_item_id: string | null;
    inventory_items: { name: string; cost_report_group: string | null } | null;
  };
  const itemIds = ((items ?? []) as unknown as Raw[]).filter((r) => r.inventory_item_id).map((r) => r.inventory_item_id as string);
  const { data: links } = itemIds.length
    ? await supabase.from("inventory_item_categories").select("inventory_item_id").eq("category_id", category.id).in("inventory_item_id", itemIds)
    : { data: [] as { inventory_item_id: string }[] };
  const itemsInBreakfastCategory = new Set((links ?? []).map((l) => l.inventory_item_id));

  const byLabel = new Map<string, number>();
  let totalSpend = 0;
  ((items ?? []) as unknown as Raw[]).forEach((r) => {
    if (!r.inventory_item_id || !itemsInBreakfastCategory.has(r.inventory_item_id)) return;
    totalSpend += Number(r.subtotal);
    const label = r.inventory_items?.cost_report_group || r.inventory_items?.name || "—";
    byLabel.set(label, (byLabel.get(label) ?? 0) + Number(r.subtotal));
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

export interface CategorySpendRow {
  category_id: string;
  category_name: string;
  total_spend: number;
  allocation: Record<CostCenter, number>;
}

export interface CostCentersSummary {
  totals: Record<CostCenter, number>;
  occupiedRoomNights: number;
  costPerOccupiedNight: number | null;
  breakdown: CategorySpendRow[];
}

// Visão consolidada dos 4 centros de custo no período: cada categoria de
// custo FIXO é ratada pelos seus 4 percentuais; categorias de custo
// DIRETO (Café da manhã/Bar da piscina/Frigobar) vão inteiras pro seu
// próprio centro; "Hospedagem" soma também o total de Café da Manhã por
// dentro (é embutido na diária, nunca cobrado à parte do hóspede).
export async function getCostCentersSummaryForPeriod(from: string, to: string): Promise<CostCentersSummary> {
  const supabase = await createClient();
  const [{ data: categories }, spendMap, occupiedRoomNights] = await Promise.all([
    supabase.from("expense_categories").select("*"),
    getCategorySpendMap(supabase, from, to),
    getOccupiedRoomNightsForPeriod(from, to),
  ]);

  let totals = emptyCostCenterTotals();
  const breakdown: CategorySpendRow[] = [];
  let cafeManhaDireto = 0;

  ((categories ?? []) as ExpenseCategory[]).forEach((cat) => {
    const totalSpend = spendMap.get(cat.id) ?? 0;
    if (cat.cost_nature === "nao_custo") return;

    let allocation = emptyCostCenterTotals();
    if (cat.cost_nature === "custo_fixo") {
      allocation = allocateFixedCost(totalSpend, cat);
      totals = addCostCenterTotals(totals, allocation);
    } else if (cat.cost_nature === "custo_direto") {
      if (cat.name === "Café da manhã") {
        allocation = { ...emptyCostCenterTotals(), cafe_manha: totalSpend };
        cafeManhaDireto += totalSpend;
      } else if (cat.name === "Bar da piscina") {
        allocation = { ...emptyCostCenterTotals(), servico_bar: totalSpend };
        totals = addCostCenterTotals(totals, allocation);
      } else if (cat.name === "Frigobar") {
        allocation = { ...emptyCostCenterTotals(), frigobar: totalSpend };
        totals = addCostCenterTotals(totals, allocation);
      }
    }
    breakdown.push({ category_id: cat.id, category_name: cat.name, total_spend: totalSpend, allocation });
  });

  // Café da manhã entra no centro "cafe_manha" (linha própria, visível no
  // detalhamento) e TAMBÉM soma dentro de "hospedagem" — embutido na
  // diária, nunca é um custo cobrado à parte.
  totals.cafe_manha += cafeManhaDireto;
  totals.hospedagem += totals.cafe_manha;

  return {
    totals,
    occupiedRoomNights,
    costPerOccupiedNight: occupiedRoomNights > 0 ? totals.hospedagem / occupiedRoomNights : null,
    breakdown: breakdown.sort((a, b) => b.total_spend - a.total_spend),
  };
}

export interface DemonstrativoMonthRow {
  month: string; // "YYYY-MM"
  category_name: string;
  total: number;
}

// Demonstrativo de Despesas: gasto por categoria, mês a mês, no
// intervalo — reagrupa sozinho quando uma categoria é editada, já que
// não persiste nada, só lê a categorização atual de cada item/linha.
export async function getExpenseDemonstrativoForPeriod(from: string, to: string): Promise<DemonstrativoMonthRow[]> {
  const supabase = await createClient();
  const [{ data: categories }, { data: rows }] = await Promise.all([
    supabase.from("expense_categories").select("id, name"),
    supabase
      .from("expense_items")
      .select("inventory_item_id, category_id, subtotal, expenses!inner(date)")
      .gte("expenses.date", from)
      .lte("expenses.date", to),
  ]);

  const categoryNameById = new Map(((categories ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  type Raw = { inventory_item_id: string | null; category_id: string | null; subtotal: number; expenses: { date: string } };
  const itemRows = (rows ?? []) as unknown as Raw[];

  const itemIds = [...new Set(itemRows.filter((r) => r.inventory_item_id).map((r) => r.inventory_item_id as string))];
  const { data: links } = itemIds.length
    ? await supabase.from("inventory_item_categories").select("inventory_item_id, category_id").in("inventory_item_id", itemIds)
    : { data: [] as { inventory_item_id: string; category_id: string }[] };
  const categoriesByItem = new Map<string, string[]>();
  (links ?? []).forEach((l) => {
    const list = categoriesByItem.get(l.inventory_item_id) ?? [];
    list.push(l.category_id);
    categoriesByItem.set(l.inventory_item_id, list);
  });

  const totalsByMonthCategory = new Map<string, number>();
  itemRows.forEach((r) => {
    const month = r.expenses.date.slice(0, 7);
    const categoryIds = r.inventory_item_id ? categoriesByItem.get(r.inventory_item_id) ?? [] : r.category_id ? [r.category_id] : [];
    const targetNames = categoryIds.length > 0 ? categoryIds.map((id) => categoryNameById.get(id) ?? "—") : ["Sem categoria"];
    targetNames.forEach((name) => {
      const key = `${month}__${name}`;
      totalsByMonthCategory.set(key, (totalsByMonthCategory.get(key) ?? 0) + Number(r.subtotal));
    });
  });

  return Array.from(totalsByMonthCategory.entries())
    .map(([key, total]) => {
      const [month, category_name] = key.split("__");
      return { month, category_name, total };
    })
    .sort((a, b) => (a.month === b.month ? a.category_name.localeCompare(b.category_name) : b.month.localeCompare(a.month)));
}

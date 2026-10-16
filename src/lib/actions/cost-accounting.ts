"use server";

import { createClient } from "@/lib/supabase/server";
import { weightedAverageUnitCost, computeDishCost } from "@/lib/cost-accounting";
import { startOfDayBrasiliaUtc, nextDayBrasiliaUtcBoundary } from "@/lib/date";
import { getPoolbarConsumptionForPeriod } from "@/lib/actions/poolbar";
import { getMinibarConsumptionForPeriod } from "@/lib/actions/minibar";

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

// "Cafés servidos" no período (Módulo Contábil Leva 5, PRD_compras&contabil.md
// seção 27): soma, dia a dia, o override do admin (daily_breakfast_settings.
// guests_served) quando existir, senão o teto calculado (total de hóspedes
// hospedados naquele dia) — mesmo padrão de fallback já usado por
// getOccupiedRoomNightsForPeriod.
async function getGuestsServedForPeriod(supabase: Supabase, from: string, to: string): Promise<number> {
  const [{ data: settings }, { data: assignments }] = await Promise.all([
    supabase.from("daily_breakfast_settings").select("date, guests_served").gte("date", from).lte("date", to),
    supabase.from("daily_breakfast_room_assignments").select("date, guest_count").gte("date", from).lte("date", to),
  ]);

  const ceilingByDate = new Map<string, number>();
  (assignments ?? []).forEach((a) => ceilingByDate.set(a.date, (ceilingByDate.get(a.date) ?? 0) + Number(a.guest_count)));
  const overrideByDate = new Map(((settings ?? []) as { date: string; guests_served: number | null }[]).map((s) => [s.date, s.guests_served]));
  const allDates = new Set<string>([...ceilingByDate.keys(), ...overrideByDate.keys()]);

  let total = 0;
  allDates.forEach((date) => {
    const override = overrideByDate.get(date);
    total += override !== undefined && override !== null ? override : ceilingByDate.get(date) ?? 0;
  });
  return total;
}

// Quantidade baixada manualmente (tela "Baixa de estoque", sem nada novo
// — ver PRD_compras&contabil.md seção 22.3 item 9) de um item no período
// — usado pro custo de itens NÃO perecíveis do café da manhã.
async function getWithdrawnQuantityForPeriod(supabase: Supabase, inventoryItemId: string, from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from("inventory_movements")
    .select("quantity")
    .eq("inventory_item_id", inventoryItemId)
    .eq("movement_type", "baixa_manual")
    .gte("created_at", startOfDayBrasiliaUtc(from))
    .lt("created_at", nextDayBrasiliaUtcBoundary(to));
  // quantity é negativa pra uma baixa — devolve a quantidade positiva baixada.
  return -((data ?? []).reduce((sum, m) => sum + Number(m.quantity), 0));
}

// Custo médio ponderado móvel de um item COMO ESTAVA no fim de uma data
// (não o custo médio atual) — soma só os movimentos até aquele instante,
// a mesma matemática de inventory_balances.avg_cost, só que num corte no
// passado. Sempre possível porque cada movimento já carrega seu próprio
// unit_cost/total_value (Módulo Contábil Leva 3) — nenhum valor
// "materializado" que precisasse ser desfeito pra voltar no tempo.
async function getAvgCostAsOfDate(supabase: Supabase, inventoryItemId: string, asOfDateKey: string): Promise<number> {
  const { data } = await supabase
    .from("inventory_movements")
    .select("quantity, total_value")
    .eq("inventory_item_id", inventoryItemId)
    .lt("created_at", nextDayBrasiliaUtcBoundary(asOfDateKey));
  const totalQty = (data ?? []).reduce((sum, m) => sum + Number(m.quantity), 0);
  const totalValue = (data ?? []).reduce((sum, m) => sum + Number(m.total_value), 0);
  return totalQty > 0 ? totalValue / totalQty : 0;
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

export interface BreakfastCostItemRow {
  label: string;
  total: number;
  // "comprado" = item perecível (ou não rastreado em estoque): 100% do
  // gasto no período. "baixado" = item não perecível: quantidade baixada
  // manualmente no período × custo médio do item no fim do período —
  // ver PRD_compras&contabil.md seção 27 (Módulo Contábil Leva 5).
  method: "comprado" | "baixado";
}

export interface BreakfastCostSummary {
  guestNights: number;
  // "Cafés servidos" (Módulo Contábil Leva 5) — o denominador correto
  // pedido pelo PRD, nunca hóspedes-noite (guestNights continua exibido
  // só como informação complementar).
  guestsServed: number;
  insumosCost: number;
  otherCost: number;
  totalCost: number;
  costPerGuestInsumos: number | null;
  costPerGuestTotal: number | null;
  byItem: BreakfastCostItemRow[];
}

// Custo do café da manhã no período (Módulo Contábil Leva 5): para cada
// item de custo ligado ao centro "Café da manhã" — buscado direto do
// Plano de Contas, não via `summary` (que só lista itens com alguma
// COMPRA neste período — insuficiente pra um item não perecível baixado
// neste período mas comprado antes) — o método de custeio depende de
// `inventory_items.is_perishable`: perecível = 100% do comprado no
// período; não perecível = quantidade baixada manualmente no período ×
// custo médio do item no fim do período (sempre derivável, mesmo no
// passado, porque cada movimento já carrega seu próprio valor — Módulo
// Contábil Leva 3). Itens de custo sem vínculo de estoque (ex.: gás,
// embalagens) continuam pela regra geral (comprado no período), já que
// não têm "baixa" nenhuma pra seguir.
//
// Nota importante: este total pode DIVERGIR do que aparece pra "Café da
// manhã" na cascata geral de `summary`/"Rateio dos custos" (que é
// sempre regime de caixa — tudo pelo comprado no período) — divergência
// esperada e não um bug: aqui mede ingrediente REALMENTE consumido,
// valorizado; lá mede dinheiro gasto no período.
export async function getBreakfastCostForPeriod(from: string, to: string): Promise<BreakfastCostSummary> {
  const supabase = await createClient();
  const [guestNights, guestsServed, spendByItem] = await Promise.all([
    getBreakfastGuestNightsForPeriod(supabase, from, to),
    getGuestsServedForPeriod(supabase, from, to),
    getSpendByCostItem(supabase, from, to),
  ]);

  const { data: links } = await supabase
    .from("cost_item_centers")
    .select("cost_item_id, alloc_pct, cost_centers!inner(name)")
    .eq("cost_centers.name", "Café da manhã");
  type LinkRaw = { cost_item_id: string; alloc_pct: number };
  const centerLinks = (links ?? []) as unknown as LinkRaw[];

  const costItemIds = [...new Set(centerLinks.map((l) => l.cost_item_id))];
  const { data: costItemsData } = costItemIds.length
    ? await supabase.from("cost_items").select("id, name, inventory_item_id, inventory_items(cost_report_group, is_perishable)").in("id", costItemIds)
    : { data: [] };
  type CostItemRaw = {
    id: string;
    name: string;
    inventory_item_id: string | null;
    inventory_items: { cost_report_group: string | null; is_perishable: boolean } | null;
  };
  const costItemById = new Map(((costItemsData ?? []) as unknown as CostItemRaw[]).map((c) => [c.id, c]));

  const byLabel = new Map<string, BreakfastCostItemRow>();
  let insumosCost = 0;
  let otherCost = 0;

  for (const link of centerLinks) {
    const costItem = costItemById.get(link.cost_item_id);
    if (!costItem) continue;
    const pct = Number(link.alloc_pct) / 100;
    const invItem = costItem.inventory_items;
    const label = invItem?.cost_report_group || costItem.name;

    let amount: number;
    let method: "comprado" | "baixado";
    let isInsumo: boolean;

    if (costItem.inventory_item_id && invItem && !invItem.is_perishable) {
      const withdrawn = await getWithdrawnQuantityForPeriod(supabase, costItem.inventory_item_id, from, to);
      const avgCost = await getAvgCostAsOfDate(supabase, costItem.inventory_item_id, to);
      amount = withdrawn * avgCost * pct;
      method = "baixado";
      isInsumo = true;
    } else {
      amount = (spendByItem.get(link.cost_item_id) ?? 0) * pct;
      method = "comprado";
      isInsumo = !!costItem.inventory_item_id;
    }

    if (isInsumo) insumosCost += amount;
    else otherCost += amount;

    const entry = byLabel.get(label) ?? { label, total: 0, method };
    entry.total += amount;
    byLabel.set(label, entry);
  }

  const totalCost = insumosCost + otherCost;

  return {
    guestNights,
    guestsServed,
    insumosCost,
    otherCost,
    totalCost,
    costPerGuestInsumos: guestsServed > 0 ? insumosCost / guestsServed : null,
    costPerGuestTotal: guestsServed > 0 ? totalCost / guestsServed : null,
    byItem: Array.from(byLabel.values()).sort((a, b) => b.total - a.total),
  };
}

export interface BarFrigobarCmvSummary {
  revenue: number;
  cmv: number;
  grossMargin: number;
  grossMarginPct: number | null;
}

// CMV e margem bruta de bar da piscina + frigobar juntos (PRD seção 9.1/
// 9.3, Módulo Contábil Leva 6) — receita pela data em que a conta foi
// PAGA (mesma base já usada pelos relatórios de consumo existentes);
// CMV pela soma de `inventory_movements.total_value` dos movimentos
// `baixa_consumo_hospede` no período, pela data do LANÇAMENTO/pedido
// (Módulo Contábil Leva 4 — o estoque desce no pedido, não no
// pagamento). As duas datas podem divergir pra uma mesma venda (pedido
// num dia, pagamento dias depois) — mesma divergência já esperada entre
// regime de caixa e regime de competência, não é um erro de cálculo.
// Simplificação deliberada: soma bar + frigobar juntos, sem separar por
// canal — os movimentos de estoque não guardam de qual dos dois vieram,
// só o quarto/conta de origem.
export async function getBarFrigobarCmvForPeriod(from: string, to: string): Promise<BarFrigobarCmvSummary> {
  const supabase = await createClient();
  const [poolbar, minibar, { data: movements }] = await Promise.all([
    getPoolbarConsumptionForPeriod(from, to),
    getMinibarConsumptionForPeriod(from, to),
    supabase
      .from("inventory_movements")
      .select("total_value")
      .eq("movement_type", "baixa_consumo_hospede")
      .gte("created_at", startOfDayBrasiliaUtc(from))
      .lt("created_at", nextDayBrasiliaUtcBoundary(to)),
  ]);

  const revenue = poolbar.total + minibar.total;
  const cmv = -((movements ?? []).reduce((sum, m) => sum + Number(m.total_value), 0));
  const grossMargin = revenue - cmv;

  return {
    revenue,
    cmv,
    grossMargin,
    grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : null,
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

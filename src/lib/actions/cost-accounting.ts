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

// ---------- Custos lidos do LIVRO CONTÁBIL ----------
// Desde a reorganização do Módulo Contábil (PRD seção 31.5/31.6), o
// Demonstrativo de Custos não calcula mais nada por conta própria: soma as
// linhas de custo e despesa do livro (o MESMO livro dos balancetes), então os
// dois sempre batem. O rateio entre centros continua vindo de UMA fonte só —
// os percentuais do cadastro do produto/despesa (cost_item_centers) —, que é
// usada na hora do lançamento; o livro guarda o resultado.

interface CostLine {
  direction: "debito" | "credito";
  amount: number;
  account_code: string;
  account_group: string;
  item_id: string | null;
  item_name: string | null;
  center_id: string | null;
  center_name: string | null;
  origin: string;
}

async function fetchLedgerLinesInRange(supabase: Supabase, from: string, to: string): Promise<CostLine[]> {
  const out: CostLine[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("ledger_entry_lines")
      .select(
        "direction, amount, cost_item_id, cost_center_id, cost_items(name), cost_centers(name), ledger_accounts!inner(code, account_group), ledger_entries!inner(entry_date, origin)"
      )
      .gte("ledger_entries.entry_date", from)
      .lte("ledger_entries.entry_date", to)
      .order("created_at", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error || !data) break;
    type Raw = {
      direction: "debito" | "credito";
      amount: number;
      cost_item_id: string | null;
      cost_center_id: string | null;
      cost_items: { name: string } | null;
      cost_centers: { name: string } | null;
      ledger_accounts: { code: string; account_group: string };
      ledger_entries: { origin: string };
    };
    (data as unknown as Raw[]).forEach((r) =>
      out.push({
        direction: r.direction,
        amount: Number(r.amount),
        account_code: r.ledger_accounts.code,
        account_group: r.ledger_accounts.account_group,
        item_id: r.cost_item_id,
        item_name: r.cost_items?.name ?? null,
        center_id: r.cost_center_id,
        center_name: r.cost_centers?.name ?? null,
        origin: r.ledger_entries.origin,
      })
    );
    if (data.length < pageSize) break;
  }
  return out;
}

const signed = (l: CostLine) => (l.direction === "debito" ? l.amount : -l.amount);
const NO_CENTER = { id: "sem-centro", name: "Sem centro de custo" };

export async function getCostCentersSummaryForPeriod(from: string, to: string): Promise<CostCentersSummary> {
  const supabase = await createClient();
  const [lines, { data: centers }] = await Promise.all([
    fetchLedgerLinesInRange(supabase, from, to),
    supabase.from("cost_centers").select("id, name").eq("active", true).order("position"),
  ]);

  const costLines = lines.filter((l) => l.account_group === "custo" || l.account_group === "despesa");
  const centerTotals = new Map<string, CenterTotal>();
  ((centers ?? []) as { id: string; name: string }[]).forEach((c) =>
    centerTotals.set(c.id, { center_id: c.id, center_name: c.name, total: 0 })
  );
  const byItem = new Map<string, CostItemBreakdownRow>();

  costLines.forEach((l) => {
    const centerId = l.center_id ?? NO_CENTER.id;
    const centerName = l.center_name ?? NO_CENTER.name;
    const v = signed(l);
    const ct = centerTotals.get(centerId) ?? { center_id: centerId, center_name: centerName, total: 0 };
    ct.total += v;
    centerTotals.set(centerId, ct);

    const itemId = l.item_id ?? "sem-item";
    const row = byItem.get(itemId) ?? { cost_item_id: itemId, cost_item_name: l.item_name ?? "(sem item)", total_spend: 0, by_center: [] };
    row.total_spend += v;
    const bc = row.by_center.find((x) => x.center_id === centerId);
    if (bc) bc.amount += v;
    else row.by_center.push({ center_id: centerId, center_name: centerName, amount: v });
    byItem.set(itemId, row);
  });

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    centerTotals: Array.from(centerTotals.values())
      .filter((c) => c.center_id !== NO_CENTER.id || Math.abs(c.total) > 0.004)
      .map((c) => ({ ...c, total: round2(c.total) })),
    breakdown: Array.from(byItem.values())
      .map((r) => ({
        ...r,
        total_spend: round2(r.total_spend),
        by_center: r.by_center.filter((c) => Math.abs(c.amount) > 0.004).map((c) => ({ ...c, amount: round2(c.amount) })),
      }))
      .filter((r) => Math.abs(r.total_spend) > 0.004)
      .sort((a, b) => b.total_spend - a.total_spend),
  };
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

// Custo do café da manhã no período: tudo que o livro lançou no centro
// "Café da manhã" (compras marcadas "para o café", baixas de estoque com
// destino café, rateio de despesas e ajustes). "Insumos" = a conta
// "Custo de alimentos e bebidas consumidos — Café da manhã"; o resto é custo
// direto do centro (ex.: gás, parte dos salários).
export async function getBreakfastCostForPeriod(from: string, to: string): Promise<BreakfastCostSummary> {
  const supabase = await createClient();
  const [guestNights, guestsServed, lines] = await Promise.all([
    getBreakfastGuestNightsForPeriod(supabase, from, to),
    getGuestsServedForPeriod(supabase, from, to),
    fetchLedgerLinesInRange(supabase, from, to),
  ]);

  const cafe = lines.filter((l) => l.center_name === "Café da manhã" && (l.account_group === "custo" || l.account_group === "despesa"));
  const byLabel = new Map<string, BreakfastCostItemRow>();
  let insumosCost = 0;
  let otherCost = 0;
  cafe.forEach((l) => {
    const v = signed(l);
    if (l.account_code === "custo-cafe-manha") insumosCost += v;
    else otherCost += v;
    const label = l.item_name ?? "(sem item)";
    const method: "comprado" | "baixado" = l.origin === "baixa-manual" || l.origin === "inventario" ? "baixado" : "comprado";
    const key = label + "|" + method;
    const entry = byLabel.get(key) ?? { label, total: 0, method };
    entry.total += v;
    byLabel.set(key, entry);
  });

  const totalCost = insumosCost + otherCost;
  return {
    guestNights,
    guestsServed,
    insumosCost,
    otherCost,
    totalCost,
    costPerGuestInsumos: guestsServed > 0 ? insumosCost / guestsServed : null,
    costPerGuestTotal: guestsServed > 0 ? totalCost / guestsServed : null,
    byItem: Array.from(byLabel.values())
      .filter((i) => Math.abs(i.total) > 0.004)
      .sort((a, b) => b.total - a.total),
  };
}

export interface BarFrigobarCmvSummary {
  revenue: number;
  cmv: number;
  grossMargin: number;
  grossMarginPct: number | null;
}

// CMV e margem bruta do bar da piscina + frigobar, lidos do livro: receita =
// contas de receita (3.xx), reconhecida quando a conta da suíte é FECHADA;
// CMV = contas de custo do bar/frigobar (4.01 a 4.04), reconhecido no momento
// do pedido. Os dois por competência, sempre batendo com o balancete.
export async function getBarFrigobarCmvForPeriod(from: string, to: string): Promise<BarFrigobarCmvSummary> {
  const supabase = await createClient();
  const lines = await fetchLedgerLinesInRange(supabase, from, to);
  const CMV_ACCOUNTS = new Set(["cmv-bebidas-bar", "custo-petiscos-bar", "custo-drinks-bar", "cmv-bebidas-frigobar"]);
  const revenue = lines.filter((l) => l.account_group === "receita").reduce((sum, l) => sum - signed(l), 0);
  const cmv = lines.filter((l) => CMV_ACCOUNTS.has(l.account_code)).reduce((sum, l) => sum + signed(l), 0);
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

// Demonstrativo de Despesas: despesas (contas do grupo "Despesa" do plano de
// contas) por CENTRO de custo, mês a mês — lido direto do livro de
// lançamentos, então já respeita o rateio de cada lançamento, estornos
// (que se anulam) e todos os fatos automáticos.
export async function getExpenseDemonstrativoForPeriod(from: string, to: string): Promise<DemonstrativoMonthRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ledger_entry_lines")
    .select("amount, direction, cost_centers(name), ledger_accounts!inner(account_group), ledger_entries!inner(entry_date)")
    .eq("ledger_accounts.account_group", "despesa")
    .gte("ledger_entries.entry_date", from)
    .lte("ledger_entries.entry_date", to);

  type Raw = {
    amount: number;
    direction: "debito" | "credito";
    cost_centers: { name: string } | null;
    ledger_entries: { entry_date: string };
  };
  const totals = new Map<string, number>();
  ((data ?? []) as unknown as Raw[]).forEach((r) => {
    const month = r.ledger_entries.entry_date.slice(0, 7);
    const key = `${month}__${r.cost_centers?.name ?? "Sem centro de custo"}`;
    const signed = (r.direction === "debito" ? 1 : -1) * Number(r.amount);
    totals.set(key, (totals.get(key) ?? 0) + signed);
  });

  return Array.from(totals.entries())
    .filter(([, total]) => Math.abs(total) > 0.004)
    .map(([key, total]) => {
      const [month, center_name] = key.split("__");
      return { month, center_name, total: Math.round(total * 100) / 100 };
    })
    .sort((x, y) => (x.month === y.month ? x.center_name.localeCompare(y.center_name) : y.month.localeCompare(x.month)));
}

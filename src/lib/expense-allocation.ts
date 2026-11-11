// Motor de rateio do modelo simplificado (PRD_modelo_simplificado.md).
// Funções puras, sem acesso a banco.

import type { CategoryRule, CenterCode } from "@/lib/expense-model-types";

const round2 = (v: number) => Math.round(v * 100) / 100;

function parseKey(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

// Divide `amount` pelos `days` dias seguidos a partir de `date` (inclusive) e
// soma por mês ("YYYY-MM"). days = 1 → tudo no mês da compra. A sobra de
// centavos fica no último mês, para a soma bater exatamente.
export function distributeByDays(date: string, amount: number, days: number): Record<string, number> {
  const [y, m, d] = parseKey(date);
  if (days <= 1) return { [`${y}-${String(m).padStart(2, "0")}`]: round2(amount) };

  const perDay = amount / days;
  const counts: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const keys = Object.keys(counts).sort();
  const out: Record<string, number> = {};
  let used = 0;
  keys.forEach((k, idx) => {
    if (idx === keys.length - 1) out[k] = round2(amount - used);
    else {
      out[k] = round2(perDay * counts[k]);
      used += out[k];
    }
  });
  return out;
}

export interface LineForAllocation {
  amount: number;
  rule: CategoryRule;
  // Percentuais fixos da categoria (regra "fixo")
  fixedCenters: { center_code: CenterCode; pct: number }[];
  // Só para regra "alimentos": % do Bar do ingrediente reconhecido (null = não é ingrediente)
  ingredientBarPct: number | null;
  // Ingrediente de alimento dividido entre bar e frigobar pelas vendas (ex.: café expresso).
  ingredientBarFrigobar?: boolean;
}

// Proporção bar × frigobar do mês para "Demais bebidas": fração do Bar (0..1).
// Sem vendas no mês, divide meio a meio — o chamador pode avisar.
export function barShareFromQuantities(barQty: number, frigobarQty: number): number {
  const total = barQty + frigobarQty;
  return total > 0 ? barQty / total : 0.5;
}

// Reparte o valor de uma linha entre os centros. Impostos (não alocável) devolvem {}.
export function splitAmountByCenters(line: LineForAllocation, barShare: number): Partial<Record<CenterCode, number>> {
  const { amount, rule } = line;
  if (rule === "nao_alocavel") return {};

  let parts: [CenterCode, number][];
  if (rule === "alimentos") {
    const bar = line.ingredientBarPct;
    if (line.ingredientBarFrigobar) parts = [["bar", barShare * 100], ["frigobar", (1 - barShare) * 100]];
    else parts = bar === null ? [["cafe", 100]] : [["bar", bar], ["cafe", 100 - bar]];
  } else if (rule === "bebidas") {
    parts = [["bar", barShare * 100], ["frigobar", (1 - barShare) * 100]];
  } else {
    parts = line.fixedCenters.map((c) => [c.center_code, c.pct]);
  }

  const active = parts.filter(([, pct]) => pct > 0);
  const out: Partial<Record<CenterCode, number>> = {};
  let used = 0;
  active.forEach(([code, pct], idx) => {
    if (idx === active.length - 1) out[code] = round2(amount - used);
    else {
      out[code] = round2((amount * pct) / 100);
      used += out[code]!;
    }
  });
  return out;
}

// Vida útil e valor decidem se um item é ativo permanente (sem depreciação).
export function isFixedAsset(
  unitAmount: number,
  usefulLifeMonths: number | null,
  threshold: number,
  minLifeMonths: number
): boolean {
  return unitAmount >= threshold && usefulLifeMonths !== null && usefulLifeMonths > minLifeMonths;
}

export interface ProductForCost {
  id: string;
  sold: number; // unidades vendidas no mês
  ingredients: { ingredientId: string; quantity: number }[]; // quantidade por unidade vendida
}

// Divide o custo mensal de cada ingrediente (parte do Bar) entre os produtos que o usam,
// na proporção (unidades vendidas × quantidade por unidade). É uma estimativa.
// Custo de ingrediente sem nenhum produto vendido que o use não é distribuído (devolvido em `unassigned`).
export function splitIngredientCostAmongProducts(
  products: ProductForCost[],
  ingredientCost: Record<string, number>
): { costByProduct: Record<string, number>; unassigned: number } {
  const costByProduct: Record<string, number> = {};
  let unassigned = 0;
  for (const [ingId, cost] of Object.entries(ingredientCost)) {
    const weights = products
      .map((p) => ({ id: p.id, w: p.sold * (p.ingredients.find((i) => i.ingredientId === ingId)?.quantity ?? 0) }))
      .filter((x) => x.w > 0);
    const totalW = weights.reduce((s, x) => s + x.w, 0);
    if (totalW === 0) {
      unassigned += cost;
      continue;
    }
    for (const x of weights) costByProduct[x.id] = (costByProduct[x.id] ?? 0) + (cost * x.w) / totalW;
  }
  return { costByProduct, unassigned };
}

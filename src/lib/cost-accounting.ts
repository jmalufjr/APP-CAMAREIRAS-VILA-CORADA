// Módulo "Custos e Despesas" — funções puras de cálculo, sem I/O (ver
// PRD_compras.md seção 20 pro raciocínio completo: pesquisa do setor
// hoteleiro, decisões confirmadas com o proprietário). Separado de
// `src/lib/actions/cost-accounting.ts` porque um arquivo "use server" só
// pode exportar Server Actions assíncronas — mesmo padrão já usado por
// `commission-math.ts`/`inventory-shrinkage.ts`.

export const COST_CENTERS = ["hospedagem", "cafe_manha", "servico_bar", "frigobar"] as const;
export type CostCenter = (typeof COST_CENTERS)[number];

export const COST_CENTER_LABELS: Record<CostCenter, string> = {
  hospedagem: "Hospedagem",
  cafe_manha: "Café da manhã",
  servico_bar: "Serviço de bar",
  frigobar: "Frigobar",
};

export interface CategoryAllocationPcts {
  alloc_hospedagem_pct: number;
  alloc_cafe_manha_pct: number;
  alloc_bar_pct: number;
  alloc_frigobar_pct: number;
}

// Divide o gasto total de uma categoria de custo fixo entre os 4 centros
// de custo, pelos percentuais cadastrados na categoria (sempre somando
// 100 — garantido por constraint no banco e validado na Server Action
// que grava os percentuais).
export function allocateFixedCost(totalSpend: number, pcts: CategoryAllocationPcts): Record<CostCenter, number> {
  return {
    hospedagem: totalSpend * (pcts.alloc_hospedagem_pct / 100),
    cafe_manha: totalSpend * (pcts.alloc_cafe_manha_pct / 100),
    servico_bar: totalSpend * (pcts.alloc_bar_pct / 100),
    frigobar: totalSpend * (pcts.alloc_frigobar_pct / 100),
  };
}

export function emptyCostCenterTotals(): Record<CostCenter, number> {
  return { hospedagem: 0, cafe_manha: 0, servico_bar: 0, frigobar: 0 };
}

export function addCostCenterTotals(a: Record<CostCenter, number>, b: Record<CostCenter, number>): Record<CostCenter, number> {
  return {
    hospedagem: a.hospedagem + b.hospedagem,
    cafe_manha: a.cafe_manha + b.cafe_manha,
    servico_bar: a.servico_bar + b.servico_bar,
    frigobar: a.frigobar + b.frigobar,
  };
}

// Custo médio ponderado: soma de tudo que foi gasto ÷ soma de tudo que
// foi comprado — não a média simples dos preços unitários de cada compra
// (decisão confirmada: dá o mesmo peso a uma compra de 2 unidades e uma
// de 200, enquanto a ponderada reflete fielmente o gasto real do mês).
// null quando não houve nenhuma compra no período (nunca confundir com
// "comprou e o custo foi zero").
export function weightedAverageUnitCost(rows: { subtotal: number; quantity: number }[]): number | null {
  const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0);
  if (totalQty === 0) return null;
  const totalSpend = rows.reduce((sum, r) => sum + r.subtotal, 0);
  return totalSpend / totalQty;
}

// Custo de 1 porção servida do prato = soma, por ingrediente da ficha
// técnica, de (porções do ingrediente no prato × quantidade do
// ingrediente em 1 porção × custo médio do ingrediente no mês). Um
// ingrediente sem nenhuma compra no mês (avgUnitCost null) é ignorado no
// cálculo desse prato — melhor um custo parcial conhecido do que
// descartar o prato inteiro por faltar 1 ingrediente.
export function computeDishCost(
  ingredients: { portions_count: number; amount_per_portion: number; avgUnitCost: number | null }[]
): number {
  return ingredients.reduce((sum, i) => sum + i.portions_count * i.amount_per_portion * (i.avgUnitCost ?? 0), 0);
}

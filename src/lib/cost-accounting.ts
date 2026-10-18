// Módulo "Custos e Despesas" — funções puras de cálculo, sem I/O (ver
// PRD_compras.md seção 21 pro raciocínio completo: Plano de Contas,
// centro → subcentro → item de custo). Separado de
// `src/lib/actions/cost-accounting.ts` porque um arquivo "use server" só
// pode exportar Server Actions assíncronas — mesmo padrão já usado por
// `commission-math.ts`/`inventory-shrinkage.ts`.

export interface CenterTotalLike {
  center_name: string;
  total: number;
}

// Custo total da Hospedagem, pra fins de custo por diária — soma o
// centro "Hospedagem" com o centro "Café da manhã" por dentro, já que o
// café não é cobrado à parte do hóspede (seu custo está embutido na
// diária, mesmo sendo um centro de custo próprio pra fins de relatório).
export function hospedagemTotalIncludingBreakfast(centerTotals: CenterTotalLike[]): number {
  const hospedagem = centerTotals.find((c) => c.center_name === "Hospedagem")?.total ?? 0;
  const cafeDaManha = centerTotals.find((c) => c.center_name === "Café da manhã")?.total ?? 0;
  return hospedagem + cafeDaManha;
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

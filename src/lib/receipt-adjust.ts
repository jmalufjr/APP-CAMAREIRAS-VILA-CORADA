// Ajusta as linhas de uma compra para que a soma bata com o TOTAL impresso na nota. Quando o
// total da nota é menor que a soma dos itens (desconto no cupom) a diferença vira desconto nas
// linhas; quando é maior (frete, taxa), vira "frete e outros custos". A diferença é repartida
// proporcionalmente ao valor de cada linha. Diferenças absurdas (mais de 50% da soma) são
// ignoradas — quase certamente é erro de leitura do total, não desconto/frete de verdade.

export interface AdjustableRow {
  subtotal: number;
  discount: number;
  freight_and_other_costs: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function applyTotalAdjustment<T extends AdjustableRow>(rows: T[], noteTotal: number | null | undefined): T[] {
  if (!noteTotal || noteTotal <= 0 || rows.length === 0) return rows;
  const sum = round2(rows.reduce((s, r) => s + r.subtotal, 0));
  const diff = round2(noteTotal - sum);
  if (Math.abs(diff) < 0.01 || sum <= 0 || Math.abs(diff) > sum * 0.5) return rows;

  const out = rows.map((r) => ({ ...r }));
  let remaining = Math.abs(diff);
  out.forEach((row, idx) => {
    const isLast = idx === out.length - 1;
    const share = isLast ? remaining : Math.min(remaining, round2((Math.abs(diff) * row.subtotal) / sum));
    remaining = round2(remaining - share);
    if (diff < 0) {
      row.discount = round2(row.discount + share);
      row.subtotal = round2(row.subtotal - share);
    } else {
      row.freight_and_other_costs = round2(row.freight_and_other_costs + share);
      row.subtotal = round2(row.subtotal + share);
    }
  });
  return out;
}

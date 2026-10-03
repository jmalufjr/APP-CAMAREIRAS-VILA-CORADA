import { nowInBrazil } from "@/lib/date";

// Dado o histórico (já fechado) de um item — cada registro com a própria
// quebra_pct e o índice_relativo_pct que tinha NAQUELE momento — calcula a
// média de quebra_pct dos últimos 12 meses, descartando qualquer registro
// cujo índice relativo tenha excedido o limite ATUAL do item (outlier).
// Pura, sem I/O — testável isolada e reaproveitada tanto pra mostrar o
// contexto na tela de contagem quanto pra gravar o valor ao fechar uma
// sessão nova. Separada de `inventory-counts.ts` porque um arquivo
// "use server" só pode exportar Server Actions assíncronas (mesmo padrão
// já usado por `commission-math.ts`).
export function computeTrailingShrinkageAverage(
  history: { quebra_pct: number; indice_relativo_pct: number | null }[],
  maxIndiceRelativoPct: number
): number | null {
  const included = history.filter((h) => h.indice_relativo_pct === null || h.indice_relativo_pct <= maxIndiceRelativoPct);
  if (included.length === 0) return null;
  return included.reduce((sum, h) => sum + h.quebra_pct, 0) / included.length;
}

export function twelveMonthsAgoIso(): string {
  const now = nowInBrazil();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, now.getUTCDate()));
  return d.toISOString();
}

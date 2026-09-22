// Cálculo puro da comissão de serviços nas suítes e no café — separado de
// src/lib/actions/commission.ts porque um arquivo "use server" só pode
// exportar Server Actions assíncronas; esta função é síncrona e sem
// nenhum acesso a banco, fácil de testar isolada.

import { toDateKey } from "@/lib/date";

// Conta usada pelo admin só pra teste/ajuste, não uma camareira de
// verdade — excluída do cálculo de comissões e dos demonstrativos/
// relatórios de comissão (Parte 36), tanto de serviços nas suítes e no
// café quanto de bar.
export const EXCLUDED_CAMAREIRA_NAME = "admin-camareira";

export interface CamareiraWeightInput {
  camareiraId: string;
  camareiraName: string;
  serviceCount: number;
  score: number;
}

export interface CamareiraWeightResult extends CamareiraWeightInput {
  servicePercent: number;
  scorePercent: number;
  weightPercent: number;
  amount: number;
}

// Peso de cada camareira = média entre o percentual de serviços (dela ÷
// total de todas) e o percentual de notas (dela ÷ soma de todas as notas).
// Como os dois percentuais somam 100% cada um, a média também soma 100% —
// o total distribuído sempre bate exatamente com o pote, sem sobra nem
// falta. Denominador zero (mês sem nenhum serviço concluído ainda, ou
// todas as notas em 0) cai pra 0% em vez de dividir por zero.
export function computeWeightedSuitesCafeCommission(
  rows: CamareiraWeightInput[],
  totalPot: number
): CamareiraWeightResult[] {
  const totalServices = rows.reduce((sum, r) => sum + r.serviceCount, 0);
  const totalScore = rows.reduce((sum, r) => sum + r.score, 0);

  return rows.map((r) => {
    const servicePercent = totalServices > 0 ? (r.serviceCount / totalServices) * 100 : 0;
    const scorePercent = totalScore > 0 ? (r.score / totalScore) * 100 : 0;
    const weightPercent = (servicePercent + scorePercent) / 2;
    const amount = totalPot * (weightPercent / 100);
    return { ...r, servicePercent, scorePercent, weightPercent, amount };
  });
}

export interface ClosedPeriod {
  // Data do fechamento do período (sempre dia 25) — chave usada em
  // commission_statements.period_end.
  periodEnd: string;
  start: string;
  end: string;
}

// A comissão de serviços nas suítes e no café não pode fechar só no fim
// do mês calendário — precisa estar pronta ANTES do mês virar, pra dar
// tempo de conferir e pagar. Por isso o corte é sempre no dia 25: o
// "último período fechado" vai do dia 26 do mês anterior ao dia 25 do mês
// de fechamento. O próprio dia 25 ainda conta como parte do período em
// formação (só fecha a partir do dia 26) — ou seja, o admin tem do dia 26
// de um mês até o dia 25 do mês seguinte pra calcular/conferir aquele
// período, antes que o próximo (fechado no dia 25 seguinte) passe a ser
// "o último".
export function closedPeriodRange(today: Date): ClosedPeriod {
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();
  let endMonth = today.getUTCMonth();
  if (day <= 25) endMonth -= 1;
  const end = new Date(Date.UTC(year, endMonth, 25));
  const start = new Date(Date.UTC(year, endMonth - 1, 26));
  return { periodEnd: toDateKey(end), start: toDateKey(start), end: toDateKey(end) };
}

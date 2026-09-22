// Cálculo puro da comissão de serviços nas suítes e no café — separado de
// src/lib/actions/commission.ts porque um arquivo "use server" só pode
// exportar Server Actions assíncronas; esta função é síncrona e sem
// nenhum acesso a banco, fácil de testar isolada.

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

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
  scoreFactor: number; // nota ÷ 10 (0 a 1): multiplica a parte da camareira
  amount: number;
}

// Regra (07/11/2026): o pote é repartido entre as camareiras pelo percentual de serviços de cada
// uma (dela ÷ total de todas) e esse valor é MULTIPLICADO pela nota ÷ 10. A nota só reduz a
// parte de quem a recebeu: mudar uma nota nunca redistribui nada para as outras (nota 10 = parte
// inteira; nota 0 = zero). Por isso o total pago pode ser menor que o pote. Mês sem nenhum
// serviço concluído cai pra 0% em vez de dividir por zero.
export function computeWeightedSuitesCafeCommission(
  rows: CamareiraWeightInput[],
  totalPot: number
): CamareiraWeightResult[] {
  const totalServices = rows.reduce((sum, r) => sum + r.serviceCount, 0);

  return rows.map((r) => {
    const servicePercent = totalServices > 0 ? (r.serviceCount / totalServices) * 100 : 0;
    const scoreFactor = Math.min(10, Math.max(0, r.score)) / 10;
    const amount = totalPot * (servicePercent / 100) * scoreFactor;
    return { ...r, servicePercent, scoreFactor, amount };
  });
}

export interface ClosedPeriod {
  // Último dia do mês anterior — chave usada em commission_statements.period_end.
  periodEnd: string;
  start: string;
  end: string;
}

// "Mês anterior": o mês calendário completo que antecede o mês de `today` (ex.: em novembro, de 01 a
// 31 de outubro). Desde 07/11/2026 não há mais corte no dia 25.
export function closedPeriodRange(today: Date): ClosedPeriod {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { periodEnd: toDateKey(end), start: toDateKey(start), end: toDateKey(end) };
}

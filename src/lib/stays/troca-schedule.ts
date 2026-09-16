// Calcula em quais noites (contadas a partir do check-in, 1-indexado)
// ocorre troca de roupa de cama/banho, para uma reserva de `totalNights`
// noites — ver PRD_regrasdenegocio.md seção 2.
//
// Regra geral: troca a cada 3 noites. Quando o período restante depois da
// última troca (ou desde o check-in, se ainda não houve troca) é EXATAMENTE
// 4 noites, esse período é dividido ao meio (2+2) em vez de 3+1, pra não
// deixar um trecho final de só 1 noite. Fórmula verificada contra os 7
// exemplos do PRD (4, 5, 6, 7, 8, 9 e 10 noites):
//
//   4 noites  -> [2]
//   5 noites  -> [3]
//   6 noites  -> [3]
//   7 noites  -> [3, 5]
//   8 noites  -> [3, 6]
//   9 noites  -> [3, 6]
//   10 noites -> [3, 6, 8]
export function trocaNights(totalNights: number): number[] {
  const trocas: number[] = [];
  let pos = 0;
  while (totalNights - pos > 3) {
    const remaining = totalNights - pos;
    const step = remaining === 4 ? 2 : 3;
    pos += step;
    trocas.push(pos);
  }
  return trocas;
}

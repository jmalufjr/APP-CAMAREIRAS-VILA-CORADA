# PRD — Indicadores (05/11/2026)

## 1. Requisito (texto do proprietário)

**Objetivo:** calcular indicadores mensais com base nas noites efetivamente atribuídas a cada mês (*room nights*):
check-in inclusivo, check-out exclusivo — ou seja, um check-out no dia 1º **não** é diária do dia 1º, mas do último dia do
mês anterior, e um check-in no último dia do mês é diária desse último dia.

**Indicadores:** ADR, RevPAR, NetRevPAR, Taxa de Ocupação Comercial e Taxa de Ocupação Física. Usar a metodologia e as
fórmulas padrão da STR/CoStar; em qualquer divergência entre a metodologia padrão da STR/CoStar e a descrita aqui, usar a da
STR/CoStar e explicar resumidamente na tela e, mais detalhadamente, em um novo item da tela "Questões e Respostas".

- **ADR** (receita média das UHs vendidas). Numerador: receita bruta de hospedagem (inclui a comissão dos canais de venda,
  exclui impostos e taxas). Denominador: total de noites efetivamente vendidas no mês (*room nights* ocupadas em todas as UHs),
  somente as diárias com faturamento — diárias grátis não contam, nem as noites de bloqueio ou manutenção.
- **RevPAR** (receita média das UHs disponíveis). Numerador: receita bruta de hospedagem (como acima). Denominador: total de
  noites disponíveis no mês, excluindo as noites com bloqueio ou manutenção.
- **NetRevPAR:** o RevPAR, mas com numerador = receita líquida de hospedagem (receita de hospedagem menos as comissões dos
  canais de venda).
- **Taxa de Ocupação Física:** numerador = todas as noites ocupadas por pagantes + noites de reservas gratuitas + noites de
  bloqueio (não conta manutenção). Denominador = todas as noites disponíveis, excluindo só as de manutenção.
- **Taxa de Ocupação Comercial:** numerador = somente as *room nights* com cobrança (não conta reservas gratuitas, nem bloqueio,
  nem manutenção). Denominador = todas as noites disponíveis, excluindo só as de manutenção.

**Receita de hospedagem:** obtida diária a diária de cada suíte dentro do mês, não importando as datas de check-in/check-out.
Uma reserva de 7 diárias com 3 no fim do mês e 4 no início do seguinte tem 3 noites (e a receita dessas 3) no primeiro mês e 4 (e a
receita dessas 4) no seguinte. Só valores de hospedagem, sem impostos/serviços que não sejam receita de hospedagem. Reservas
canceladas não entram em nenhum indicador.

**Comissão:** informada pelo admin como percentual (ex.: 15%), **por canal**, num card no topo da tela. ADR e RevPAR usam a
receita antes das comissões; o NetRevPAR desconta as comissões.

**Tela:** nova tela "Indicadores", abaixo do menu "Avaliações dos hóspedes", no Resumo executivo, usando os dados da API da
Stays e os do banco do app conforme o que render melhor desempenho (velocidade). Todos os meses disponíveis: histórico completo
e até seis meses depois do mês corrente. Separação clara entre meses fechados e o mês corrente/seguintes.

Instruções: salvar este texto como `PRD_indicadores.md`, implementar, testar, perguntar o que for necessário, commit e push.

## 2. Decisões de implementação

| Ponto | Decisão |
|---|---|
| Fonte dos dados | Stays (reservas confirmadas, pré-reservas e contratos com o preço por diária; bloqueios e manutenção do calendário). Guardado no app por mês e por canal (`indicator_*`), atualizado a cada sincronização — a tela lê só do banco (rápida). |
| Histórico | Importação completa na 1ª abertura (ou botão); sincronizações seguintes (manual e cron) refazem de 3 meses atrás até 6 meses à frente. |
| Receita | Preço de cada diária dos "períodos de preço" da reserva (mesma regra do Ticket médio de canais), sem taxas/impostos. Diária com valor 0 (ou sem preço) = gratuita. |
| Comissão | `channel_commissions` (um % por canal, inclusive "Outros"). Aplicada na hora de exibir, então mudar o % recalcula todos os meses (a comissão não é congelada por mês). |
| Admin e gerente | A tela é só do **admin** (tem receita), como o Ticket médio. |

### 2.1 Divergências da STR/CoStar (a STR prevalece)

1. **Noites disponíveis (RevPAR, Ocupação):** a STR define oferta = nº de UHs × dias do mês, **sem** descontar noites bloqueadas
   ou em manutenção (só se a UH sair do inventário, como numa reforma longa informada à STR). O PRD pedia descontá-las. Usei a
   **STR**; as noites de bloqueio e manutenção aparecem em colunas à parte para conferência.
2. **Ocupação Comercial:** é a "Occupancy" da STR (noites vendidas pagas ÷ noites disponíveis); com a divergência 1, o denominador
   é o total de noites do mês.
3. **Ocupação Física:** não existe na STR; mantida como o PRD define (pagas + gratuitas + bloqueio, sobre disponíveis menos
   manutenção).
4. **ADR/RevPAR:** receita bruta antes das comissões e sem impostos (igual ao PRD e à STR). Diárias gratuitas ficam fora da receita
   e do "vendidas" (a STR também exclui cortesias).
5. **NetRevPAR** não é métrica da STR; segue o PRD (receita − comissões) sobre a mesma oferta do RevPAR.

## 3. Plano

1. Migração 095 (`indicator_months`, `indicator_month_channels`, `channel_commissions`) + schema + produção.
2. Regras puras `src/lib/stays/indicators.ts` com testes (virada de mês, grátis, bloqueio, manutenção, cancelada).
3. Busca da Stays em janelas de 6 meses; `syncStaysIndicators` (cron + botões); ações de leitura e de comissão.
4. Tela `/dashboard/indicadores` (card de comissões, meses fechados, mês corrente e seguintes, explicação resumida) e item de menu.
5. Item novo em "Questões e Respostas"; CLAUDE.md (Parte 61); testes locais; commit e push.

# PRD — Camareira revisora

> Requisito do proprietário (recebido em 01/11/2026), transcrito fielmente em
> formato de documento. Regra de trabalho dada por ele: **sempre que houver
> dúvida, não inventar — perguntar; sempre que houver questão relevante, não
> decidir — perguntar.** Só depois de tudo esclarecido: implementar, testar e
> preparar para teste em produção (commit, push etc.). As respostas às
> dúvidas ficam registradas na seção "Dúvidas e decisões" no fim deste arquivo.

## 1. Objetivo

Implementar uma **instância revisora** do serviço realizado nas suítes pelas
camareiras. Passam a existir duas funções sobre o serviço designado a uma
suíte:

- **Camareira executora**: executa o serviço na suíte (como hoje).
- **Camareira revisora**: revisa o serviço executado, sempre uma camareira
  **diferente** da executora.

## 2. Situação atual

A camareira vai à suíte e realiza o trabalho (arrumação, troca, somente saída,
somente chegada ou saída com chegada), tica todos os itens do checklist,
eventualmente informa ocorrências de manutenção e observações, e entrega o
serviço. Esse serviço é dado como **contabilizado para ela**: conta na
quantidade de trabalhos realizados e impacta a comissão.

## 3. Novo fluxo

### 3.1 Execução → pendente de revisão
Ao ser finalizado pela camareira executora, o serviço **retorna para a página
de escolha de serviços**, agora numa nova etapa: a **etapa de revisão**, a ser
executada por uma camareira diferente da que fez o serviço na suíte.

Enquanto a suíte não for escolhida para revisão, o serviço permanece
**pendente**, com a indicação de **"pendente de revisão"**. Ele só passa a
constar como **trabalho concluído** quando **todas as etapas** (incluindo a
revisão) estiverem esgotadas.

### 3.2 Revisão
A camareira revisora, ao escolher o trabalho de revisão, recebe o **mesmo
checklist** do serviço executado. Para cada item, ela deve marcar uma de duas
opções: **completo** (realizado por completo) ou **incompleto** (realizado de
forma incompleta).

- A seleção é feita numa **caixa de seleção** (completo / incompleto) que
  **inicia em branco**; a revisora precisa escolher a opção aplicável.
- A revisora pode informar **ocorrências de manutenção** e **observações do
  serviço**, da mesma forma que a executora.
- O **consumo de frigobar** vira um **item final do checklist** em que a
  revisora apenas informa **completo** ou **incompleto**.
- Ao final, a revisora aperta **"Encerrar revisão"**. O sistema só permite
  encerrar se **todos** os itens do checklist (incluindo frigobar) estiverem
  com completo/incompleto selecionado.
- O sistema registra a **hora em que o trabalho de revisão foi escolhido** e a
  **hora em que foi encerrado**.

### 3.3 Correção (quando há item incompleto)
Se algum item for marcado como **incompleto**, o serviço **não volta** para a
tela de escolha de serviços: vai **diretamente para o campo de serviço escolhido
da camareira executora**, com a indicação **"serviço de correção"**.

- O serviço de correção só abre para a executora quando ela aperta
  **"Iniciar correção"**. A partir daí ela recebe **apenas o(s) item(ns)
  marcados como incompletos** pela revisora.
- Se o **consumo de frigobar** foi marcado como incompleto, o registro de
  frigobar **reabre** para a executora corrigir. Ele vem **já com os valores
  registrados inicialmente por ela**, que podem ser editados: se não forem
  alterados, permanecem como os corretos; se forem registrados novos valores,
  o sistema atualiza o consumo de frigobar **após encerrado o serviço de
  correção**.
- A executora tica (como faz na execução) cada item incompleto para indicar
  que foi corrigido. Só depois de todos ticados é possível apertar
  **"Finalizar correção"**.
- Ao finalizar a correção, o sistema registra **hora de início, hora de fim e
  duração** da correção. A partir desse momento, o serviço na suíte é dado
  como **encerrado**.

## 4. Telas e relatórios

### 4.1 Resumo operacional → "Serviços nas suítes" → "Serviços dos últimos 7 dias"
Hoje, ao clicar na linha da tabela, aparece o checklist preenchido pela
camareira executora. A mesma tabela que informa o trabalho de execução passa a
mostrar também, para a **revisão** e para a **correção**: **data/hora de início
(escolha)**, **término** e **tempo de duração**.

### 4.2 Histórico
O sistema deve mostrar no **Histórico** uma tabela **exatamente igual** à de
"Serviços dos últimos 7 dias" (Resumo operacional → Serviços nas suítes),
porém com **consulta por período selecionado**.

## 5. Dúvidas e decisões

### 5.1 Decididas pelo proprietário (01/11/2026)

1. **Comissão** — o serviço só passa a contar quando o ciclo inteiro termina
   (revisão sem incompletos, ou correção finalizada). **Executora e revisora
   contam**: cada revisão concluída conta como um serviço para a revisora
   (peso igual a um serviço executado).
2. **Suítes vagas e limpas** — uma Somente Saída executada mas pendente de
   revisão (ou em revisão/correção) aparece como **suja**; só vira limpa quando o
   serviço estiver totalmente concluído.
3. **Quem revisa** — somente camareira **diferente** da executora. Se não houver
   outra camareira disponível, o **admin ou o gerente operacional pode dispensar
   a revisão** daquele serviço, que passa a concluído.
4. **Frigobar com a conta já fechada/paga na correção** — a correção do frigobar
   **não altera o consumo** e mostra um aviso; o restante da correção segue e o
   admin trata o ajuste fora do fluxo.

### 5.2 Premissas adotadas (propostas ao proprietário, sem objeção)

5. A revisão vale para os cinco tipos de serviço.
6. A revisora vê, só para leitura, as ocorrências e observações da executora.
7. A revisora pode desistir da revisão antes de encerrar: o serviço volta a
   "pendente de revisão".
8. Serviços já concluídos antes do deploy continuam concluídos, sem revisão
   retroativa; a regra vale para serviços liberados a partir do deploy.
9. Na tabela "Serviços dos últimos 7 dias" cada serviço continua numa linha, com
   colunas novas de Revisão (revisora, início, término, duração) e de Correção
   (início, término, duração). O Histórico ganha a mesma tabela com filtro de
   período e exportação CSV.
10. Terminada a correção o serviço fecha, sem segunda revisão (como descrito).
11. Na tela de escolha de serviços há uma seção própria "Aguardando revisão",
    separada dos serviços a executar, com a indicação "pendente de revisão".

## 6. Implementação e testes (01/11/2026)

**Banco** — migrações `083_revisao_status_enum.sql` (4 novos valores de `task_status`:
`aguardando_revisao`, `em_revisao`, `aguardando_correcao`, `em_correcao`) e
`084_revisao_servico.sql` (colunas em `daily_room_tasks`/`daily_room_task_checks`,
políticas de leitura para a revisora e funções `security definer`: `release_daily_room_task`
(agora leva a "pendente de revisão"), `claim_review`, `release_review`,
`set_review_check_result`, `set_review_minibar_result`, `finish_review`, `start_correction`,
`set_correction_check`, `set_correction_minibar_done`, `finish_correction`, `waive_review`).
A policy `drt_camareira_update_own` foi restringida a `pendente/em_andamento`, para a executora não
poder mexer no status depois de liberar.

**Telas** — `ReviewPanel` (revisora), `CorrectionPanel` (executora), seção "Aguardando revisão" em
"Minhas suítes", `OccurrencesCard` extraído do checklist, tabela de serviços com colunas de
revisão/correção (Resumo operacional e Histórico, com filtro de período), lista "Serviços aguardando
revisão ou correção" com botão "Dispensar revisão" (admin/gerente) e resumo da revisão no detalhe do
serviço.

**Comissão** — `getServiceCountsByCamareira` soma +1 para a revisora de cada serviço concluído com revisão
real (não dispensada); a revisora entra na lista de camareiras do período.

**Fora do escopo desta entrega** — a exportação CSV da tabela de serviços no Histórico (prevista na
premissa 9) não foi implementada; a tabela e o filtro de período sim.

**Testes feitos localmente** — fluxo completo no banco com duas camareiras e gerente (executora não revisa a
própria; encerrar revisão exige tudo marcado; incompleto → correção → concluído; desistir; dispensar
pelo gerente, negado para camareira) e renderização das telas com sessão real (admin e camareira) em
cada estado.

**Produção** — rodar `supabase/producao/04-revisora-etapa-A-enums.sql` (sozinho) e depois
`05-revisora-etapa-B-tabelas-funcoes.sql` no SQL Editor **antes** de publicar o código. Serviços já
concluídos permanecem concluídos.

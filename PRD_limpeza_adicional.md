# PRD — Limpeza adicional (03/11/2026)

## 1. Requisito (texto do proprietário)

Vamos criar um novo tipo de serviço nas suítes que chamaremos de **"Limpeza adicional"**. Esse serviço terá o mesmo
checklist do serviço de *saída com chegada*, ou de *somente saída* ou de *troca*, adicionando a eles quatro itens a
mais:

1. **Limpeza do filtro do ar condicionado** — usar escada, retirar o filtro, lavar o filtro na lavanderia e enxugar,
   colocar de volta o filtro e passar pano com produto de limpeza no ar condicionado.
2. **Limpeza do topo do armário de roupas** — passar pano úmido com produto de limpeza no topo do armário.
3. **Limpeza da base da cama** — retirar o colchão e aspirar em cima e embaixo da base da cama, passar pano com
   produto de limpeza na lateral da base e limpar os pés da base.
4. **Limpeza do espelho da cama** — aspirar, passar pano com produto de limpeza, passar lustra-móveis.

Haverá uma lista nova para esse serviço, no menu *Listas operacionais / Check lists*, onde o admin e o gerente
operacional podem editar esses itens adicionais.

Não é um sexto tipo de serviço alocado sozinho: é um **acréscimo** a uma tarefa de saída com chegada / somente saída /
troca, escolhida por uma regra de decisão, **uma única vez por semana por suíte** (de preferência de segunda a quinta).
O nome exibido passa a ser "Saída com chegada com Limpeza adicional", "Somente saída com Limpeza adicional" ou
"Troca com Limpeza adicional".

### 1.1 Regra de alocação

- A primeira sincronização do dia (manual ou a automática das 6h) já distribui a limpeza adicional para o dia da
  sincronização e para o dia seguinte (a primeira sincronização de domingo aloca a segunda-feira). Cada dia recalcula
  o dia de hoje e calcula o de amanhã, excluindo as suítes já alocadas antes na semana, até a quinta-feira.
- No máximo **3 suítes por dia** de segunda a quarta e **2 na quinta**. Se um dia não conseguir atingir o máximo,
  pode-se alocar **uma suíte acima do máximo** nos dias seguintes, para que as 11 suítes fiquem alocadas de segunda a
  quinta.
- As que sobrarem vão para sexta, depois sábado, depois domingo (máx. 3 por dia).
- As que sobrarem no fim da semana "não terão preferência de alocação na semana seguinte, ou seja, deverão ser
  escolhidas primeiro assim que possível".
- Nunca mais de uma alocação por suíte por semana.
- Preferência de tipo (sem quebrar a regra de quantidade por dia): **somente saída**, depois **saída com chegada**, depois
  **troca** (alterado em 10/11/2026).

### 1.2 Execução por duas camareiras

- O serviço precisa ser escolhido por **duas** camareiras e só pode começar depois que a segunda escolher.
- O horário de início registrado é o da escolha da **segunda** camareira.
- O checklist aparece **somente para a primeira** que escolheu; ela o preenche e entrega.
- O serviço conta para as **duas** para todos os efeitos (comissão, histórico, relatórios).

## 2. Decisões de implementação (lacunas resolvidas)

| Ponto | Decisão |
|---|---|
| Semana | Segunda a domingo, fuso de Brasília. |
| Suítes elegíveis | As que, no dia, têm tarefa de troca / saída com chegada / somente saída ainda **pendente e sem camareira**. Tarefas já escolhidas ou iniciadas nunca recebem a limpeza adicional. |
| Tipo novo de checklist | `limpeza_adicional` (valor novo do enum `checklist_type`), lista editável em *Listas operacionais → Check list de Limpeza adicional* (admin e gerente). Não aparece como opção do Planejamento Diário. |
| Marca na tarefa | `daily_room_tasks.extra_cleaning` (boolean). Os 4 itens são copiados para o checklist da tarefa, **depois** dos itens do serviço base. |
| Teto por dia | **Até 10/11/2026** (regra antiga): segunda a quarta 3, quinta 2, sexta a domingo 3, com +1 de folga acumulada. **A partir da distribuição de 11/11/2026**: no máximo 3 por dia; até 5 suítes com serviço no dia → até 3; de 6 a 9 → até 2; mais de 9 → nenhuma. A folga +1 deixou de existir (conflita com o máximo). |
| Prioridade dos dias | Segunda, terça, quarta, quinta, sexta, domingo e, por último, sábado. Se a segunda-feira da semana for feriado nacional, a ordem começa na terça e a segunda passa a ter a prioridade do domingo (sábado continua por último). Feriados nacionais em `src/lib/holidays-br.ts` (sem Carnaval/Corpus Christi). Vale na ordem em que uma execução processa os dias (hoje e amanhã). |
| Recalcular | Cada sincronização refaz "completar vagas": mantém as tarefas já marcadas (e não escolhidas), nunca mexe nas escolhidas/iniciadas, e só preenche as vagas que faltam. |
| Sobra de semana | Na semana seguinte, as suítes que ficaram **sem** limpeza adicional na semana anterior têm prioridade (vêm antes na escolha, antes da preferência de tipo). Sem acúmulo além disso. |
| Duas camareiras | `second_assigned_to` / `second_claimed_at`. A primeira escolha (já existente) só reserva; a segunda escolha (função `claim_extra_cleaning_second`) dispara o início (`claimed_at` = momento da segunda escolha). A segunda não pode ser a mesma pessoa. Enquanto não há segunda, o checklist fica bloqueado e a suíte não pode ser liberada. |
| Cancelar escolha | A primeira que cancela devolve o serviço ao pool, limpando também a segunda. A segunda que cancela só libera a vaga dela (o serviço volta a aguardar a segunda). |
| Revisão | A revisora não pode ser nenhuma das duas executoras. |
| Comissão / histórico | A segunda camareira também recebe +1 serviço (mesmas regras da primeira) e aparece no registro de serviços e nas durações. |
| Rótulo | `taskTypeLabel(tipo, limpezaAdicional)` em `src/lib/task-type.ts`. |
| Suítes vagas e limpas | Sem mudança: o tipo base da tarefa continua definindo o resultado. |

## 3. Plano

1. Migrações 090 (enum) e 091 (colunas, itens, políticas, funções) + `schema.sql` + `supabase/producao/`.
2. Algoritmo puro `planExtraCleaning` (`src/lib/extra-cleaning.ts`) + testes.
3. Integração em `syncStaysPlanning` (marca e copia os 4 itens).
4. Ação `claimExtraCleaningSecond`, ajustes de cancelar/liberar/revisar.
5. Telas: lista nova em *Listas operacionais*; quadro de tarefas da camareira (dois passos de escolha); rótulos no
   planejamento, registro de serviços e histórico; comissão e histórico contando as duas.
6. Testes no banco local, "Questões e Respostas", CLAUDE.md (Parte 57), commit e push.

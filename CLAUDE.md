@AGENTS.md

# Camareiras Vila Corada — Resumo do projeto

> Registro objetivo do que foi construído e das decisões tomadas, escrito
> como se fosse o planejamento de fases que teria sido feito antes de
> começar. Serve para retomar o contexto do zero caso a conversa com o
> Claude seja perdida. Requisitos completos e changelog detalhado ficam em
> `PRD_Camareiras_parte01.md` — este arquivo é o mapa rápido de "o que existe
> e onde".

## O que é

Web app de gestão do serviço de camareiras da pousada Vila Corada:
planejamento diário de arrumação/preparação/troca de quartos, checklists,
ocorrências de manutenção, layout e hóspedes das mesas do café da manhã,
chegadas/saídas do dia e comissão da equipe. Uma segunda parte do projeto
adicionou um módulo completo de manutenção corretiva (ocorrências,
funcionário de manutenção) e preventiva (categorias/itens recorrentes,
checklists) — **já mesclada em `main` e implantada em produção** (branch
`feature/manutencao` integrada via PR #1). Ver seção "Parte 02 do projeto"
abaixo e `PRD_Camareiras_parte02.md`. Uma terceira leva de iterações (ver
seção 10) reorganizou a tela "Listas" em submenu, adicionou ordenação de
itens de checklist/manutenção preventiva e datas iniciais configuráveis
para o cronograma de manutenção preventiva. Uma quarta leva (seção 11)
adicionou controle de consumo de frigobar e do bar da piscina por quarto,
com conta compartilhada entre os dois (fechar/reabrir/pagar) e cards
equivalentes no histórico e no "Resumo executivo". Uma quinta leva (seção 12)
substituiu o lançamento direto de consumo do bar da piscina por um sistema
de comandas (pedidos por quarto, numerados, editáveis/canceláveis) e passou
o fechamento/reabertura/pagamento da conta do quarto do admin para a
camareira — o admin passou a só visualizar. Uma sexta leva (seção 13)
adicionou o envio automático por e-mail (Resend) do recibo em PDF de uma
conta de quarto ao ser paga, com reenvio manual pelo admin em caso de
falha, e uma tela de pagamento por PIX (QR code estático) acionada pela
camareira quando a conta está fechada. Uma sétima leva (seção 14)
acrescentou o formato de mesa "Quadrada" ao layout do café. Em
15/09/2026 o app entrou em uso real ("Parte 08", seção 15): os dados de
teste foram zerados do banco de produção, o lançamento de quantidade de
frigobar pela camareira passou a usar o mesmo seletor +/- já usado nas
comandas de bar, e o ambiente de desenvolvimento local passou a rodar num
Supabase isolado via Docker em vez de compartilhar o banco de produção.
Em seguida vieram: checklists "Saída com Chegada"/"Somente Saída"/"Somente
Chegada" e configuração diária de mesas (Parte 09); serviços atrasados
não somem mais da tela da camareira, cancelamento e um log de 7 dias no
Resumo Executivo (Parte 10); a primeira fase da integração com a API de
reservas da Stays, sincronizando o Planejamento Diário (Parte 11,
`PRD_regrasdenegocio.md`); a renomeação "Quarto" → "Suíte" em todo o app e
a alocação de suítes por mesa no layout do café, com tonalidade mais clara
para mesas ocupadas (Parte 12); a extensão da sincronização com a Stays
para Chegadas & Saídas (com busca do nome do hóspede) e Mesas do Café (com
o algoritmo de distribuição por proximidade da vista do mar) — Parte 13; a
automação por Vercel Cron (sincronização automática diária, sem
sobrescrever edições do admin), a transformação dos três botões manuais em
sincronização **forçada** (ignora as edições do admin de propósito) e a
tela dos 4 campos de contagem por tamanho de mesa (Parte 14); e, por fim,
duas tabelas "lápide" que permitem ao admin apagar uma tarefa do
Planejamento Diário ("Sem trabalho") ou uma alocação de suíte numa mesa,
sem que isso seja desfeito pela próxima sincronização automática (Parte
15); e a troca dos 4 campos de contagem de mesas — e também do próprio "Total
de mesas" — de "sincronizados"/"seletor manual" para "sempre calculados na
hora" a partir da alocação suíte↔mesa, eliminando o risco de ficarem
desatualizados (Partes 16 e 17); uma tela "Questões e
Respostas" no menu do admin, explicando em linguagem simples as 10
funcionalidades mais importantes do app pra quem for operá-lo (Parte 18);
telas da camareira simplificadas pra só "hoje" e ajustes de layout dos
cards de tarefa (Parte 19); as cores de mesa ocupada/vaga invertidas, com
receita própria por tema (Parte 20); e a aba "Hoje" virando
sempre o padrão (mesmo em Mesas do Café, que antes era exceção) nas três
telas com seletor Hoje/Amanhã, além de ajustes de layout menores (Parte
21). Numa leva mais recente (Partes 22 a 29, 17–20/09/2026): o registro de
Início/Término/Duração de cada serviço da camareira (Resumo Executivo e
Histórico); a correção de um problema de fronteira na API da Stays que
fazia a sincronização perder saídas cujo check-out caía exatamente no dia
consultado; ajustes finos na distribuição de suítes pelas mesas do café
(só a Mesa 07 pode reunir mais de uma suíte) e a exibição do consumo de
frigobar/bar no detalhe de um serviço concluído visto pelo admin; a
possibilidade de a camareira cancelar a própria escolha de uma suíte; o
lançamento de frigobar passando a ser sempre aditivo; a alocação de
suítes por mesa migrando dos antigos cards por mesa para um diálogo
aberto ao clicar na própria mesa do layout, com destaque visual pras
mesas editadas manualmente e um segundo botão de sincronização que
preserva edições; e uma reformulação da comissão, que passou a depender
da quantidade de suítes elegíveis pro café (não mais da alocação efetiva
numa mesa), com o valor de cada mês fechado congelado no Histórico — essa
reformulação expôs, já em produção, um bug real de sincronização de
mesas, corrigido na mesma leva junto com a atualização completa da tela
"Questões e Respostas" pra refletir tudo isso. Em seguida (Partes 30 a
33, 21/09/2026): uma comissão de 10% do bar da piscina por camareira,
atribuída a quem lançou cada comanda originalmente, com a numeração da
comanda passando a ser sequencial pelo mês inteiro em vez de por conta do
quarto; a possibilidade de a camareira isentar a taxa de serviço de 10%
numa conta específica (ela não é obrigatória por lei), o que também tira
a comissão só das comandas daquela conta; o Resumo Executivo
reestruturado como um hub — 5 cards de consulta rápida do mês no topo e
um menu abaixo levando a telas de detalhe, cada uma com botão de voltar;
e uma nova tela nesse menu, "Suítes vagas e limpas, disponíveis para
alugar", com a regra de negócio (o que conta como "disponível" e como
"limpa") desenvolvida junto com o proprietário em várias rodadas de
crítica antes de implementar. Em seguida, os três pares de botão de
sincronização com a Stays (antes um em cada tela) foram unificados num
só, no Resumo Executivo; e a antiga "comissão das camareiras" (café da
manhã) ganhou nome próprio, "Comissão de serviços nas suítes e no café",
e passou a ser repartida entre as camareiras por uma nota de qualidade
de serviço (editável, 0 a 10) combinada com o percentual de serviços de
cada uma, com um demonstrativo em PDF/e-mail gerado sob demanda pelo
botão "Calcular comissão do último período" na tela "Comissões das
camareiras" (antes só a comissão de 10% do bar) — esse período fecha
sempre no dia 25, não no fim do mês, e a conta de teste "admin-camareira"
nunca entra em nenhum cálculo de comissão.

## Onde está

- **Repositório**: https://github.com/jmalufjr/APP-CAMAREIRAS-VILA-CORADA (branch `main`, deploy automático a cada push)
- **Produção**: https://app-camareiras-vila-corada.vercel.app
- **Banco**: projeto Supabase próprio (Postgres + Auth + Row Level Security)

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
(`@base-ui/react`) + Supabase (Postgres/Auth/RLS) + Recharts + next-themes.
Toda mutação de dados passa por Server Actions (`src/lib/actions/*.ts`); não
há rotas de API REST nem uso do cliente Supabase do navegador — leitura
também é feita em Server Components.

## Fases de desenvolvimento (ordem em que foi feito)

1. **Fundação**: scaffold Next.js + Tailwind + shadcn/ui; clientes Supabase
   (browser/server/admin/middleware); schema SQL inicial (`supabase/schema.sql`)
   e seed (`supabase/seed.sql`) com os 11 quartos, itens de checklist
   (arrumação/preparação), categorias de ocorrência e 9 mesas do café; tema
   visual (paleta clara/escura da marca, fontes) e logo provisório.
2. **Autenticação e layout base**: login por seleção de nome pré-cadastrado
   + senha (Supabase Auth); middleware de proteção de rotas por papel
   (admin/camareira); sidebars separadas por papel, responsivas (menu Sheet
   no mobile).
3. **CRUD administrativo core**: Quartos, Camareiras (criação via Auth Admin
   API, reset de senha), Checklists & Ocorrências (itens por tipo de
   trabalho e por quarto, categorias de ocorrência), valor da comissão.
4. **Mesas do café**: layout arrastável, CRUD de mesas, hóspedes por mesa
   (hoje/amanhã), cálculo de comissão.
5. **Planejamento diário e execução pelas camareiras**: admin define tipo de
   trabalho por quarto/dia; camareira preenche checklist, registra
   ocorrências e observações, libera o quarto.
6. **Dashboard e Histórico**: cards de resumo do dia, gráfico mensal,
   tabela histórica filtrável por período com exportação CSV.
7. **Deploy em produção**: Vercel conectada ao GitHub, variáveis de
   ambiente configuradas com boas práticas (chave secreta do Supabase nunca
   exposta ao client — ver seção "Segurança" abaixo).
8. **Iterações pós-lançamento** (mudanças de requisito pedidas ao longo do
   uso — detalhadas em `PRD_Camareiras_parte01.md` seção 8):
   - Modo claro/escuro com **dois** temas escuros (bordô e azul), seletor de
     3 opções em todas as telas.
   - Logo oficial (PNG, troca automática por tema) substituindo o
     desenho provisório; padronização do lettering "Vila Corada / CAMAREIRAS".
   - **Mudança de fluxo importante**: camareira passou a escolher o próprio
     quarto entre os disponíveis, em vez de o admin atribuir manualmente.
   - Terceiro tipo de trabalho **"Troca"** + renomeação
     "Preparação" → **"Preparação Chegada"**.
   - Seletor Hoje/Amanhã no Planejamento diário (componente reutilizável
     `DateSwitcher`).
   - Nova tela **Chegadas & Saídas** (admin edita, camareira lê).
   - Limite de 10 hóspedes por mesa (independente da capacidade configurada)
     + campo de observações por mesa, visível também no dashboard do admin.
   - Renomeação "Ocorrências" → **"Ocorrências Manutenção"** em todo o app;
     novas telas de visibilidade para o admin (`/ocorrencias`,
     `/ocorrencias/[data]`, `/ocorrencias/historico`) com ranking das 10
     categorias mais frequentes; mesma coluna/ranking adicionados ao
     `/historico` geral.
   - Duas novas categorias de ocorrência: "Mau cheiro quarto" e
     "Mau cheiro banheiro".
   - `PRD_Camareiras_parte01.md` criado como PRD vivo, atualizado com todo
     esse changelog.
9. **Parte 02 — módulo de Manutenção** (branch `feature/manutencao`,
   implementada, testada e **mesclada em `main`/implantada** — detalhada na
   seção "Parte 02 do projeto" abaixo e em `PRD_Camareiras_parte02.md`):
   - Novo papel **"Funcionário de Manutenção"**; tela "Camareiras" virou
     **"Usuários"** (cadastra os dois papéis).
   - **Ocorrências de manutenção** ganharam ciclo de vida
     pendente → selecionada → resolvida, com tela própria para o
     funcionário de manutenção selecionar/resolver.
   - Módulo de **Manutenção Preventiva** novo: categorias e itens
     recorrentes (9 categorias × ~10 itens, seed baseado em boas práticas
     do setor), com tela do funcionário organizada em cards por
     categoria+semana e dashboard do admin por semana.
   - Item de menu "Checklists & ocorrências manutenção" renomeado para
     **"Listas"**.
   - Lição de arquitetura importante: transições de estado sensíveis
     (selecionar/resolver/concluir) usam funções `security definer` no
     Postgres em vez de policies de RLS de UPDATE combinadas — ver
     "Regras específicas desta parte 02" abaixo.
10. **Parte 03 — reorganização de "Listas", ordenação de itens e datas de
    manutenção preventiva** (feita direto em `main`, pós-merge da parte 02):
    - **Latência no checklist da camareira**: o toque num item esperava um
      round trip completo ao servidor (1 select + até 3 updates) e depois
      um `router.refresh()` de página inteira antes do "X" aparecer.
      Resolvido com UI otimista no cliente (estado local atualizado no
      clique, sem esperar o servidor) + a função `security definer`
      `toggle_daily_room_task_check` (migration 012), que colapsa as
      idas ao banco em 1 round trip.
    - **"Listas" virou um submenu vertical** em vez de abas: `/checklists`
      lista Arrumação, Troca, Preparação Chegada, Ocorrências Manutenção,
      Manutenção Preventiva, Quartos e Layout & mesas, cada um como rota
      própria com botão "Voltar" (`src/components/shared/back-link.tsx`).
      **Quartos** foi movido de `/quartos` para `/checklists/quartos`, e
      **só a aba "Layout & mesas"** (não a tela inteira "Mesas do café")
      foi movida para `/checklists/mesas` — "Mesas do café" continua no
      menu principal, agora só com "Hóspedes de hoje/amanhã" e o valor da
      comissão (`src/app/(admin)/mesas/gerenciar/guests-admin-panel.tsx`).
    - **Ordenação de itens**: o admin escolhe a posição (inclusive
      primeira/última) de um item ao criar ou editar, tanto em
      `checklist_items` (arrumação/troca/preparação) quanto em
      `maintenance_items` (compartilhada entre técnico e não técnico da
      mesma categoria). Implementado com as funções `security definer`
      `reorder_checklist_items`/`reorder_maintenance_items` (migration
      013), que recebem a lista completa de ids já na ordem final e
      reescrevem `position` de todos em 1 round trip. Cada card mostra o
      número da posição atual e anima (técnica FLIP, sem lib nova) ao
      reordenar.
    - **Data inicial da manutenção preventiva**: `maintenance_categories`
      ganhou `start_date` (data da primeira manutenção da categoria); cada
      `maintenance_items` tem `follows_category_start_date` (padrão true)
      e seu próprio `start_date` opcional para quando um item precisa de
      cronograma independente. `next_due_date` é recalculada a partir
      dessas datas por `compute_next_due_date`/`recompute_category_schedule`/
      `recompute_item_schedule` (migration 014) — **não** substitui o
      reagendamento "flutuante" já existente ao concluir um item
      (`next_due_date = current_date + periodicidade`), que continua
      valendo depois da primeira conclusão.
    - **Bug real encontrado em teste**: as chamadas `supabase.rpc(...)` de
      reordenação/recálculo não checavam `.error` — quando a migration 013
      ainda não tinha sido rodada no banco, a Server Action retornava
      sucesso mesmo sem reordenar nada, e só apareceu porque o usuário
      testou manualmente (não em `npm run build`/`lint`). Lição: **toda**
      chamada a `supabase.rpc()` numa Server Action precisa checar
      `.error` e devolvê-lo, nunca assumir sucesso.
    - **`daily_room_task_checks` é um snapshot**: os itens de uma tarefa do
      dia são copiados de `room_checklist_items` só no momento em que o
      admin define o tipo de trabalho do quarto naquele dia
      (`setRoomTask`); um item de checklist criado depois não aparece
      retroativamente em tarefas já criadas. `createChecklistItem` agora
      faz esse *backfill* automaticamente, mas só nas tarefas do mesmo
      tipo/quarto que ainda não estão `concluido` — tarefas já concluídas
      nunca são alteradas.
    - Realce sutil (pontinho, não fundo colorido — fundo colorido lia como
      "selecionado") nos 3 itens mais usados do menu do admin
      (Planejamento diário, Chegadas & saídas, Mesas do café).
11. **Parte 04 — Consumo de Bar e Frigobar** (feita direto em `main`, pós
    parte 03):
    - **Catálogos novos** geridos em "Listas": `minibar_items` (frigobar —
      "Consumo de Frigobar", `/checklists/frigobar`, seed com 5 itens) e
      `poolbar_items` (bar da piscina — "Bar da Piscina",
      `/checklists/poolbar`, com `category` opcional para agrupar em
      Petiscos/Bebidas, seed com as ~19 itens do cardápio real).
    - **Ciclo de conta único por quarto**, compartilhado entre frigobar e
      bar da piscina: `room_bills.status` = `aberta → fechada → reaberta →
      paga`, com no máximo 1 conta não-paga por quarto (unique index
      parcial). O consumo (`room_bill_minibar_items`/`room_bill_poolbar_items`)
      não é mais vinculado a uma tarefa/dia específico — é um valor por
      (conta, item) que qualquer camareira/admin pode somar enquanto a
      conta estiver aberta ou reaberta; ao fechar, a camareira fica
      bloqueada (RLS); ao marcar como paga, nasce automaticamente uma conta
      nova `aberta` para o quarto. `src/lib/room-bills.ts` tem o helper
      `getOrCreateCurrentBill`, que chama a função `security definer`
      `ensure_room_bill` (necessária porque INSERT direto em `room_bills` é
      admin-only via RLS, mas a camareira precisa poder garantir a conta de
      um quarto novo na primeira vez que lança consumo nele).
    - **Telas**: camareira lança frigobar dentro do checklist de cada
      tarefa (`/tarefas/[taskId]`, mesmo componente `ChecklistDetail`) e bar
      da piscina numa tela própria (`/bar-piscina`, menu principal dela) —
      ambas em formato **acordeão** (`src/components/ui/accordion.tsx`,
      novo wrapper de `@base-ui/react/accordion`), não mais cards em grid:
      um card em grid com ~19 itens de nomes longos cortava o campo de
      quantidade; o acordeão dá largura de tela inteira a cada quarto
      expandido. Admin gerencia tudo em `/frigobar` ("Consumo de Bar e
      Frigobar", também acordeão): cada quarto mostra os totais de
      frigobar e bar da piscina, taxa de serviço de 10% sobre o bar, total
      geral, botões "Fechar a conta" / "Pagamento efetuado" /
      "Editar/reabrir conta" (este último libera campos de quantidade
      editáveis ali mesmo, tanto de frigobar quanto de bar da piscina).
    - **Histórico e "Resumo executivo" (dashboard, ex-"Dashboard")**
      ganharam cards de frigobar e bar da piscina (nessa ordem) iguais aos
      já existentes de mesas/comissão: tabela item×quantidade×total por
      período/mês atual/mês anterior, e dois gráficos de pizza (% no mês /
      % desde o início). Como o consumo não tem mais data própria, esses
      totais somam pela data em que a conta foi **paga** (`paid_at`), não
      pela data do lançamento.
    - **Gráficos de pizza**: nome do item sobreposto na própria fatia
      (fonte pequena, halo na cor do card por trás do texto para continuar
      legível em qualquer cor de fundo), só para os 5 maiores itens; a
      lista de nome+percentual fica só na legenda abaixo do gráfico — a
      `<Legend>` do Recharts foi trocada por uma lista HTML própria porque
      a legenda automática colidia com os rótulos externos quando havia
      muitos itens pequenos.
    - **Bug real corrigido nesta parte**: uma `<TableRow>` de totais
      (tabela "Resumo diário" do histórico) estava fora de `<TableBody>`/
      `<TableFooter>`, direto como filha de `<Table>` — inválido em HTML,
      causava erro de hidratação. Corrigido envolvendo com `<TableFooter>`
      (já existia no componente base `src/components/ui/table.tsx`, só não
      estava sendo usado). Pré-existente, não introduzido por esta parte.
12. **Parte 05 — Comandas de bar da piscina** (feita direto em `main`, pós
    parte 04; requisitos completos em `PRD-comandas.md`):
    - **Consumo de bar deixou de ser um valor editado por item** e passou a
      vir de **comandas** (pedidos por quarto): `bar_comandas` (numeração
      `sequence_number` sequencial **por conta** — reinicia em 1 sempre que
      o quarto ganha uma conta nova ao ser paga — e status `original` /
      `cancelada` / `editada`; não existe um quarto estado "em edição"
      persistido, foi decisão explícita do proprietário não gravá-lo) e
      `bar_comanda_items` (item + quantidade + preço no momento do pedido).
      Substituem `room_bill_poolbar_items` (migration 016), removida nesta
      parte (migration 018). Frigobar não mudou em nada.
    - **Todas as transições passam por funções `security definer`**
      (`submit_comanda`/`edit_comanda`/`cancel_comanda`), seguindo o padrão
      já estabelecido — nunca INSERT/UPDATE direto pela camareira. Editar
      uma comanda também permite trocar o quarto (decisão explícita do
      proprietário, ao contrário da minha recomendação inicial): a comanda
      passa a pertencer à conta corrente do novo quarto, com nova
      numeração se for uma conta diferente.
    - **Fechar/reabrir/marcar como paga a conta do quarto virou ação da
      camareira**, não mais do admin: `close_room_bill`/`reopen_room_bill`/
      `pay_room_bill` (também `security definer`) substituíram os UPDATEs
      diretos que existiam em `src/lib/actions/room-bills.ts` desde a parte
      04 — mesma lógica de antes, só a checagem de papel muda de
      `is_admin()` para a nova `is_camareira()`.
    - **Telas novas da camareira**: "Comanda" (`/comanda` — lista de
      comandas ativas + botão "Novo pedido") e o formulário de pedido
      (`/comanda/novo` e `/comanda/[id]/editar`, mesmo componente
      `comanda-form.tsx` para criar e editar), com seletor de quantidade em
      stepper (+/-) em vez de campo numérico — exigência explícita do
      proprietário para não deixar a camareira digitar números. A antiga
      tela "Consumo de Bar da Piscina" da camareira (`/bar-piscina`) virou
      "Consumo por quartos": mesmo acordeão e mesmas ações que a extinta
      tela do admin (fechar/reabrir/pagar), com a diferença de que a seção
      de bar agora é só leitura (soma das comandas ativas do quarto) e só o
      frigobar continua editável ali.
    - **Tela do admin `/frigobar` virou só leitura**, com duas abas
      (`src/components/ui/tabs.tsx`): "Lista de comandas do bar"
      (`comandas-list-panel.tsx`, mesmo componente de detalhe
      `src/components/shared/comanda-detail-dialog.tsx` reaproveitado da
      tela da camareira) e "Consumo por quartos" (`frigobar-rooms-panel.tsx`,
      sem nenhum botão de ação nem campo editável).
    - **Lição de eficiência**: o modal de "ver itens da comanda" não busca
      dados sob demanda ao clicar — `getActiveComandas()` já traz os itens
      de cada comanda embutidos na mesma consulta da lista. Uma primeira
      versão buscava os itens num `useEffect` ao abrir o modal, mas isso
      cai na regra de lint `react-hooks/set-state-in-effect` (evitar
      `setState` direto dentro de um efeito) e, mais importante, introduz
      um round trip extra por clique — evitado ao carregar tudo de uma vez
      no primeiro carregamento da página, coerente com o requisito de
      "processamento rápido, sem delays".
    - **Bug real encontrado em teste manual**: `edit_comanda` já bloqueava
      editar uma comanda quando a conta do quarto de **destino** estava
      fechada, mas `cancel_comanda` não checava status nenhum — permitia
      cancelar uma comanda de um quarto com a conta fechada, contrariando a
      regra de que nada pode ser feito numa comanda depois que a conta é
      fechada. Corrigido na migration `019_comanda_closed_bill_guard.sql`:
      `cancel_comanda` passou a checar o status da conta atual da comanda, e
      `edit_comanda` passou a checar também o status da conta **original**
      da comanda (antes só olhava a de destino) — assim trocar de quarto na
      edição não vira uma forma de contornar o bloqueio. A tela também
      passou a travar proativamente (steppers, seletor de quarto e os dois
      botões desabilitados + aviso) assim que a comanda editada pertence a
      uma conta fechada, em vez de só mostrar o erro depois de tentar
      salvar/cancelar.
    - **Bug encontrado em teste manual, RLS de `profiles`**: a tela
      "Comanda" da camareira mostrava "—" no lugar do nome de quem fez a
      última ação sempre que essa ação foi de OUTRA camareira. Causa: a
      única policy de select em `profiles` era "própria linha ou admin" — o
      join embutido pro nome de created_by/last_action_by falha
      silenciosamente (volta null) quando o dono da linha é outra
      camareira. Corrigido com a policy `profiles_camareira_select_camareiras`
      (migration `022`), mesmo padrão já usado para o funcionário de
      manutenção ver colegas camareiras.
13. **Parte 06 — Recibo em PDF por e-mail e pagamento por PIX** (feita
    direto em `main`, pós parte 05):
    - **PDF do recibo gerado sob demanda, sem persistir arquivo nenhum**:
      `src/lib/receipt-pdf.tsx` usa `@react-pdf/renderer` (`renderToBuffer`)
      pra montar o PDF a partir dos dados já existentes no banco (itens de
      frigobar/bar, totais) toda vez que é preciso — tanto pro link "Ver
      PDF" do admin quanto pro anexo do e-mail (envio automático e
      reenvio). Decisão deliberada de não usar nenhum serviço de storage
      (Supabase Storage/Vercel Blob): como os dados de uma conta paga são
      imutáveis, reconstruir o PDF sempre a partir do banco é mais simples
      e sempre fiel, sem arquivo órfão pra gerenciar.
    - **E-mail só no pagamento, nunca no fechamento**: `pay_room_bill`
      (migration `023`) passou a devolver o id da conta paga (antes era
      `void`) pra `markRoomBillPaid` conseguir gerar e mandar o recibo
      daquela conta específica por e-mail (via Resend) logo em seguida — só
      pro e-mail fixo da contabilidade, nunca por quarto/hóspede. Envio é
      **melhor esforço**: nunca lança erro nem bloqueia a confirmação de
      pagamento pra camareira — o resultado (sucesso/falha) fica gravado em
      `room_bills.receipt_email_sent` via a função `mark_receipt_email_sent`
      (checa `is_camareira() or is_admin()`, já que tanto o envio
      automático quanto o reenvio manual do admin passam por ela).
    - **E-mail de destino configurável pelo admin, não fixo por variável de
      ambiente** (adicionado logo depois, ainda dentro desta parte):
      migration `024_receipt_settings.sql` criou a tabela singleton
      `receipt_settings` (mesmo padrão de `commission_settings`) com a
      coluna `accounting_email`; um card "E-mail da contabilidade" no final
      da aba "Consumo por quartos" do admin (dentro de
      `frigobar-rooms-panel.tsx`) deixa esse e-mail editável ali mesmo, sem
      precisar mexer em variável de ambiente nenhuma.
    - **Domínio de envio verificado no Resend**: `consumos.vilacorada.com.br`
      — um subdomínio dedicado (não o domínio raiz do site nem `www`),
      registrado como domínio próprio no Resend com os registros DKIM (TXT)
      e SPF (2 CNAME) adicionados manualmente no painel DNS do Registro.br
      (o domínio já roda nos servidores DNS do próprio Registro.br). Escolha
      deliberada de subdomínio em vez do domínio raiz: isola a reputação de
      envio deste sistema automatizado de um futuro e-mail "de verdade" da
      pousada no domínio principal. Remetente padrão
      `recibos@consumos.vilacorada.com.br` (`src/lib/actions/room-bills.ts`,
      função `sendReceiptEmail`), sobrescrevível pela variável de ambiente
      opcional `RECEIPT_FROM_EMAIL` caso precise trocar no futuro.
    - **Admin vê e reenvia, camareira nunca vê o PDF**: a aba "Consumo por
      quartos" do admin, na seção "Contas pagas (últimos 7 dias)"
      (`frigobar-rooms-panel.tsx`), ganhou um botão "Ver PDF" (aponta pra
      `/api/room-bills/[billId]/receipt`, uma Route Handler que gera o PDF
      na hora e checa `role === "admin"` manualmente — rotas de API não
      passam pelo middleware de proteção por papel, que só olha caminhos de
      página) e, quando `receipt_email_sent` é `false`, um badge vermelho
      "E-mail não enviado" já visível no card fechado do acordeão + um
      aviso destacado + botão "Reenviar e-mail". A camareira não tem acesso
      a nada disso — nem o link do PDF nem o resultado do envio aparecem em
      nenhuma tela dela.
    - **Pagamento por PIX é uma imagem estática, não um QR dinâmico**: a
      camareira, com a conta fechada, tem um botão "Pagar com PIX" que abre
      `/bar-piscina/pix/[roomId]` — mostra a imagem `public/pix-qrcode.png`
      (chave PIX fixa da pousada, sem valor embutido) + o valor total da
      conta como texto ao lado, pro hóspede digitar manualmente ao pagar. A
      imagem fica num fundo branco fixo (não segue o tema escuro do app) e é
      renderizada com `<img>` simples, não `next/image` — de propósito,
      pra não passar pelo otimizador de imagem do Next.js (recompressão/
      reamostragem que poderia degradar a nitidez de um QR code, que precisa
      de bordas nítidas pra ser lido pela câmera).
    - **Lição de teste**: `@react-pdf/renderer` (via sua dependência
      `@react-pdf/hyphenate`) falha com `ERR_PACKAGE_PATH_NOT_EXPORTED`
      quando rodado fora do bundler do Next.js (testado isoladamente via
      `npx tsx`) — o pacote é ESM-only e algo no caminho de resolução do
      `tsx` tenta um `require()` CJS num subpath que só tem condição
      `import`. **Isso não é um bug real** (o bundler do Next.js resolve
      normalmente); a forma correta de testar geração de PDF nesta stack é
      sempre através de uma rota/Server Action real rodando no `next dev`,
      nunca isolado via `tsx`/`ts-node`.
14. **Parte 07 — Mesa quadrada no layout de mesas** (feita direto em
    `main`, pós parte 06): novo formato de mesa `table_shape` = `'square'`
    (migration `025_mesa_quadrada.sql`), ao lado dos já existentes `round`/
    `rect`. O lado da quadrada usa o mesmo tamanho fixo 70×70 já usado pela
    redonda (só o retângulo tem largura/altura diferentes entre si) — a
    diferença entre as três é só visual: círculo (`rounded-full`), quadrado
    de cantos discretamente arredondados (`rounded-md`) e retângulo de
    cantos mais arredondados (`rounded-2xl`, como antes). Como
    `TableLayoutCanvas` (`src/components/shared/table-layout-canvas.tsx`)
    é o único componente que desenha o formato — reaproveitado tanto no
    editor de layout do admin (`/checklists/mesas`) quanto na visão da
    camareira (`/mesas`) — bastou uma mudança nesse componente para
    impactar as duas telas ao mesmo tempo, sem duplicação.
15. **Parte 08 — Início do uso real: limpeza de dados de teste, stepper de
    frigobar e ambiente local isolado** (15/09/2026, feita direto em
    `main`, pós parte 07):
    - **Zeramos os dados de teste do banco de produção** no dia em que o
      app começou a ser usado de verdade: apagadas todas as linhas de
      `daily_room_tasks` (com `daily_room_task_checks`/
      `daily_room_task_occurrences` em cascata), `daily_breakfast`,
      `daily_arrivals`, `daily_departures`, `maintenance_completions` e
      `room_bills` (com `room_bill_minibar_items`/`bar_comandas`/
      `bar_comanda_items` em cascata) — todas datadas antes de hoje.
      **Preservado**: `rooms`, `breakfast_tables` (layout atual),
      catálogos (`checklist_items`, `minibar_items`, `poolbar_items`,
      `occurrence_categories`, `maintenance_categories`) e `profiles`
      (usuários, incluindo uma conta `admin-camareira` de origem
      duvidosa que o proprietário optou por não mexer por enquanto). Os
      94 `maintenance_items` que tinham `status = 'selecionada'` presa de
      teste voltaram para `'pendente'`, e `next_due_date` de todos foi
      recalculada (hoje, para quem não tem `start_date` real configurada;
      preservada para os poucos itens/categorias que já tinham uma data
      real própria) — sem isso o funcionário de manutenção veria itens
      "já selecionados" por ninguém de verdade.
    - **Quantidade de frigobar lançada pela camareira virou seletor +/-**
      (igual à comanda de bar), em vez de campo de texto numérico —
      exigência explícita do proprietário, igual ao motivo já documentado
      para a comanda (evitar a camareira precisar digitar números). O
      stepper foi extraído para um componente compartilhado,
      `src/components/shared/quantity-stepper.tsx` (antes só existia
      dentro de `comanda-form.tsx`), e passou a ser usado nos dois lugares
      onde a camareira lança frigobar: o checklist do quarto
      (`checklist-detail.tsx`) e a tela "Consumo por quartos"
      (`consumo-quartos-panel.tsx`, ao reabrir uma conta fechada pra
      editar). Cada clique no `+`/`-` já salva na hora (não existe
      "blur"/confirmação separada como no campo de texto antigo).
    - **Ambiente de desenvolvimento local deixou de compartilhar o banco
      de produção** — decisão tomada porque o app entrou em uso real e
      testes locais não podem mais poluir dados/estatísticas reais. Ver
      `README.md` seção 4 para o passo a passo completo. Resumo: Supabase
      rodando localmente via Docker (`npx supabase start`), configurado
      em `supabase/config.toml` (criado por `npx supabase init`, sem
      precisar instalar o CLI globalmente). **Detalhe técnico
      importante**: `[db.migrations]` e `[db.seed]` estão **desabilitados**
      nesse config — `supabase/migrations/` começa em `002` (não existe
      uma migration `001`; o schema inicial foi aplicado direto no painel
      da nuvem antes deste projeto usar o CLI), então o replay automático
      de migrations que `supabase start`/`db reset` fariam por padrão
      quebra contra um banco vazio. Por isso o bootstrap do banco local é
      manual, sempre `schema.sql` **antes** de `seed.sql`, direto via
      `docker exec -i supabase_db_APP_Camareiras_Vila_Corada psql -U
      postgres -d postgres -f -` (não via `supabase db query -f`, que não
      aceita arquivos com múltiplos comandos SQL). `.env.local` agora
      aponta para o Supabase local por padrão; as credenciais reais da
      nuvem foram movidas para `.env.local.cloud` (nunca versionado, só
      para o caso raro de precisar testar contra produção). De propósito,
      `.env.local` local **não** tem `RESEND_API_KEY` configurada — sem
      ela, o envio de recibo por e-mail falha silenciosamente (já é
      "melhor esforço" por design) em vez de mandar e-mail de teste de
      verdade pra conta real da contabilidade.
16. **Parte 09 — Novos checklists de saída/chegada e configuração diária de
    mesas do café** (16/09/2026, feita direto em `main`, pós parte 08;
    testada primeiro no ambiente local via Docker antes de aplicar em
    produção, seguindo o fluxo descrito na Parte 08):
    - **"Preparação Chegada" renomeado para "Saída com Chegada"** (só o
      rótulo — o valor do enum continua `preparacao`) e dois checklists
      novos: **"Somente Saída"** e **"Somente Chegada"**, cobrindo os três
      cenários possíveis de giro de quarto — arrumação/troca não mudaram.
      "Saída com Chegada" e "Somente Saída" compartilham a mesma lista de
      22 itens (limpeza completa, já que mesmo um quarto só com saída pode
      receber reserva de última hora) mais 2 itens novos de conferência
      (pertences esquecidos do hóspede que saiu / itens do quarto como
      chaves e controles que não podem ter sido levados); só não têm
      itens de boas-vindas, que dependem de uma chegada com data certa.
      "Somente Chegada" (23 itens) parte da mesma base mas os itens de
      limpeza viram uma revisão mais leve (quarto já foi limpo numa
      "Somente Saída" anterior), sem os itens de pertences esquecidos, e
      ganha itens de boas-vindas (chocolate, flor, cheirinho) e ênfase em
      testar o funcionamento dos aparelhos. Migration
      `026_checklists_saida_chegada.sql` (enum novo + conteúdo dos itens
      + associação a todos os quartos) e `schema.sql`/`seed.sql`
      atualizados para instalações novas. A tela de planejamento diário,
      o menu "Listas", a tela da camareira e o histórico já eram
      genéricos o bastante (dirigidos por `TASK_TYPE_OPTIONS`/
      `TASK_TYPE_LABELS` em `src/lib/task-type.ts`) pra aceitar os tipos
      novos sem mudança — só `src/app/(admin)/historico/history-tables.tsx`
      precisou ser generalizado (tinha 3 colunas de tipo de trabalho
      fixas no código, viraram um loop sobre `TASK_TYPE_OPTIONS`).
    - **Bug real corrigido nesta parte**: o seletor de tipo de trabalho no
      planejamento diário (`planning-board.tsx`) voltava a mostrar o valor
      cru do enum (ex.: "preparacao") em vez do rótulo assim que uma opção
      era selecionada — o componente `Select` do Base UI só "adivinha" o
      rótulo a partir do item quando o menu está montado; ao fechar, sem
      um jeito explícito de resolver o rótulo, ele cai pro valor cru.
      Corrigido passando uma função pro `<SelectValue>` (`children` como
      `(value) => label`), o padrão oficialmente documentado pelo Base UI
      pra esse caso — não testado nos outros `<SelectValue>` do app, então
      se o mesmo sintoma aparecer em outra tela, aplicar a mesma correção.
    - **Descrição dos itens de checklist da camareira virou um popover**:
      antes aparecia sempre abaixo do nome do item, em fonte pequena
      (`checklist-detail.tsx`); ocupava espaço demais no celular. Agora só
      o nome do item aparece (fonte maior, `text-base`), com um botão de
      informação (ícone "i") que abre a descrição — mesmo tamanho de
      fonte do nome — num popover ancorado no próprio item (não cobre a
      tela, não navega, fecha ao clicar de novo no mesmo lugar). Vale para
      todos os checklists da camareira, que passam pelo mesmo componente.
    - **Configuração diária de mesas do café, separada do controle por
      mesa**: nova tabela `daily_breakfast_settings` (uma linha por dia,
      `total_tables` + `notes`, migration `027_daily_breakfast_settings.sql`)
      — complementa, não substitui, `daily_breakfast` (que continua
      controlando hóspedes/observação por mesa individual). Na tela do
      admin (`/mesas/gerenciar`, agora com abas "Mesas de hoje"/"Mesas de
      amanhã" em vez de "Hóspedes de hoje"/"Hóspedes de amanhã"), logo
      abaixo da data aparecem um seletor de "Total de mesas" (0 até o
      número de mesas ativas — valor manual do admin, independente da
      contagem "Total de mesas ocupadas" já existente, calculada a partir
      do hóspede lançado por mesa) e uma caixa de "Observação do dia". Os
      dois valores aparecem pra camareira em `/mesas`, cada um no seu
      próprio card, acima do layout de mesas — a observação usa
      `whitespace-pre-wrap` pra preservar exatamente as quebras de linha
      que o admin digitou (sem isso, texto em lista virava uma linha só).
      Os cards de mesa na tela do admin passaram a ser ordenados em ordem
      crescente pelo número extraído do rótulo (`"Mesa 3"` → `3`), não
      mais pela ordem de criação no banco.
17. **Parte 10 — Serviços atrasados não somem mais, cancelamento e log de 7
    dias no resumo executivo** (16/09/2026, feita direto em `main`, pós
    parte 09; testada primeiro no ambiente local antes de aplicar em
    produção):
    - **Cards "Mesas · hoje/amanhã" saíram do Resumo Executivo e foram para
      o final da tela "Mesas do café" (`/mesas/gerenciar`)** — o layout
      visual (`TableLayoutCanvas`/`TableNotesList`) reaproveita os mesmos
      dados que a tela já buscava pras abas "Mesas de hoje/amanhã", sem
      fetch novo.
    - **Nova tabela "Serviços dos últimos 7 dias"** no Resumo Executivo,
      logo abaixo dos cards "Quartos de hoje"/"Quartos de amanhã": lista
      `daily_room_tasks` com status `concluido` ou `cancelado` dos últimos
      7 dias (data, quarto, tipo, camareira), ordenada por data
      decrescente e, dentro do mesmo dia, por número do quarto crescente.
      Linha de serviço cancelado mostra "Cancelado por {nome}" em vez do
      nome de quem executou (não clicável — nunca houve nada preenchido).
      Linha de serviço concluído é clicável e abre
      `/dashboard/tarefas/[taskId]`, uma visão **somente leitura** nova
      pro admin, reaproveitando o mesmíssimo componente
      `src/components/shared/checklist-detail.tsx` da tela da camareira
      (movido de dentro de `(camareira)/tarefas/[taskId]/` pra
      `components/shared/` justamente por passar a ser usado nos dois
      lugares) — o componente já trava tudo sozinho quando
      `task.status === 'concluido'` (checkboxes, formulário de ocorrência,
      frigobar), não precisou de nenhuma prop nova de "somente leitura".
      **Decisão importante, não pedida explicitamente**: essa visão do
      admin **não mostra consumo de frigobar** — a prop `minibar` do
      `ChecklistDetail` virou opcional e a seção inteira só aparece quando
      ela é passada. Motivo: frigobar é por **conta corrente do quarto**,
      não por tarefa/dia (ver Parte 04) — mostrar "o frigobar de hoje"
      rotulado como "o que a camareira preencheu naquele dia" seria
      mostrar dado errado sempre que a conta do quarto já tiver girado
      desde então. Se quiser esse dado ali mesmo assim, dá pra reconsiderar
      (ex.: rotular claramente como "estado atual da conta", ou investir
      num snapshot de frigobar por tarefa — mudança de modelo de dados
      maior, fora do escopo desta parte).
    - **Serviços de dias anteriores não reivindicados por ninguém não
      somem mais da tela "Meus quartos" da camareira**: antes, a tela só
      buscava `daily_room_tasks` do dia corrente (`.eq('date', hoje)`), e
      um serviço `pendente` sem `assigned_to` de um dia passado ficava
      invisível pra sempre assim que o dia virava (mesmo as RLS policies
      de `daily_room_tasks` já sendo abertas por ownership, sem filtro de
      data — o corte sempre foi só na query da página). "Disponíveis para
      escolher" virou duas subseções: "Serviços de hoje" (como antes) e
      "Serviços anteriores" (`date < hoje`, `status = 'pendente'`,
      `assigned_to is null`, sem limite de quantos dias voltam). Uma
      camareira pode **escolher** um serviço anterior (mesma
      `claimTask`, sem mudança — ele passa a aparecer em "Meus quartos"
      referenciando a **data original**, não hoje) ou **cancelar**
      (`cancelTask`/`cancel_daily_room_task`, novo enum `task_status` =
      `'cancelado'` + colunas `cancelled_by`/`cancelled_at` — migration
      `028_cancelar_servico_pendente.sql`). Implementado como função
      `security definer` (checando `is_camareira()`), não mais uma policy
      de UPDATE na tabela — `daily_room_tasks` já tem duas policies de
      UPDATE pra camareira (`drt_camareira_update_own`/`drt_camareira_claim`)
      e o próprio `CLAUDE.md` já documentava o risco de combinar mais uma
      ali (ver "Convenções e decisões importantes" abaixo). "Meus quartos"
      também passou a buscar tarefas de dias anteriores ainda atribuídas à
      própria camareira (`pendente`/`em_andamento`) — sem isso, escolher um
      "serviço anterior" faria ele desaparecer de vez (não é mais "hoje",
      então não aparecia nem em "disponíveis" nem em "meus quartos").
      Cards de serviço de dia anterior mostram a data ao lado do tipo, pra
      deixar claro que não é de hoje.
18. **Parte 11 — Integração com a Stays, fase 1: Planejamento Diário**
    (16/09/2026, feita direto em `main`, pós parte 10; requisitos completos
    em `PRD_regrasdenegocio.md`; credenciais/mapeamento em `README.md`
    seção 6):
    - **Credenciais obtidas e gravadas**: `STAYS_BASE_URL` (subdomínio da
      própria conta, não um host genérico da Stays — ex.:
      `https://jmj.stays.net`), `STAYS_CLIENT_ID`/`STAYS_CLIENT_SECRET`
      (rótulos "Login"/"Senha" na tela "Chaves da API" do App Center da
      Stays) em `.env.local` e `.env.local.cloud` — **ainda não
      adicionadas na Vercel** (só necessário quando a sincronização for
      automatizada por cron; o gatilho manual atual roda a partir de
      qualquer ambiente onde essas variáveis existam).
    - **Mapeamento quarto ↔ listing**: coluna `rooms.stays_listing_id`
      (migration `029_stays_integracao_schema.sql`), já populada pros 11
      quartos — os listings da Stays já se chamam "Suite 01".."Suite 11",
      batendo exatamente com o número do quarto no app, sem ambiguidade.
      O valor usado é o campo `_id` de `GET /external/v1/content/listings`
      (formato longo, é o mesmo valor do campo `_idlisting` em cada
      reserva) — **não** o campo curto `id` (código interno da Stays).
    - **Endpoint e parâmetros verificados na prática** (não documentados
      em detalhe na doc pública): `GET /external/v1/booking/reservations`
      com `from`/`to`/`dateType=included` retorna todas as reservas cujo
      período de estadia toca alguma data do intervalo — inclusive
      hóspedes que já fizeram check-in antes de `from`. Outros valores
      possíveis de `dateType` (não usados aqui): `arrival`, `departure`,
      `creation`, `creationorig`. O campo `type` da reserva é `"booked"`
      (reserva de hóspede de verdade) ou algo como bloqueio de calendário
      do proprietário — `src/lib/stays/client.ts` já filtra só `"booked"`.
    - **Regra de preferência (PRD seção 1) implementada via coluna
      `stays_locked`** em `daily_room_tasks` (e, já preparadas no schema
      pras próximas fases, em `daily_arrivals`, `daily_departures`,
      `daily_breakfast` e `daily_breakfast_settings` — migration
      `029_stays_integracao_schema.sql`): quando `true`, a sincronização
      nunca sobrescreve a linha. `setRoomTask` (edição manual do admin no
      Planejamento Diário) grava `stays_locked = true`. A sincronização
      também nunca mexe numa linha já reivindicada por uma camareira
      (`assigned_to` preenchido) ou que já saiu do status `pendente`
      (em andamento/concluída/cancelada) — mesmo sem lock explícito,
      trabalho já em curso nunca é tocado. **Limitação conhecida, não
      resolvida ainda**: se o admin escolhe explicitamente "Sem trabalho"
      pra um quarto/dia (limpando a linha), isso *apaga* a linha em vez de
      deixar um registro travado — a sincronização pode recriar uma
      tarefa ali no próximo ciclo se a Stays ainda indicar uma reserva
      relevante. Resolver isso exigiria uma forma de representar
      "admin decidiu explicitamente que não há trabalho" sem depender da
      existência da linha (schema atual não permite `task_type` nulo).
    - **Fórmula de troca por quantidade de noites** (PRD seção 2,
      `src/lib/stays/troca-schedule.ts`, função `trocaNights`): troca a
      cada 3 noites, exceto quando o período restante desde a última troca
      (ou desde o check-in, se ainda não houve troca) é **exatamente 4**
      noites — nesse caso, em vez de 3+1, divide-se ao meio (2+2). Fórmula
      verificada contra os 7 exemplos do PRD (4,5,6,7,8,9,10 noites) antes
      de integrar; ver comentário no arquivo pra tabela completa.
    - **`src/lib/stays/derive-planning.ts`** (`deriveWorkType`): dado o
      conjunto de reservas de um quarto e uma data, decide entre
      `preparacao` (Saída com Chegada), `somente_saida`, `somente_chegada`,
      `troca`, `arrumacao` ou `null` (quarto vago) — pura, sem I/O, fácil
      de testar isolada (foi testada isolada antes de integrar).
    - **`src/lib/actions/stays-sync.ts`** (`syncStaysPlanning`): usa o
      client admin/service-role (`createAdminClient`), não a sessão do
      usuário — necessário porque essa função precisa também rodar sem
      ninguém logado quando virar um cron job (ainda não configurado
      nesta parte; por enquanto o gatilho é manual, botão "Sincronizar com
      a Stays" na tela `/planejamento`, `sync-stays-button.tsx`). Busca
      reservas de hoje+amanhã numa única chamada, deriva o tipo por quarto
      via `deriveWorkType`, e só recria a tarefa quando o tipo mudou (evita
      apagar/recriar — e perder o progresso do checklist — sem necessidade
      quando o tipo já está correto).
    - **Testado com dados reais da API de produção da Stays** (não só
      localmente com mocks): rodado contra o banco local via uma rota de
      API temporária (mesmo truque já usado antes neste projeto pra testar
      coisas que só funcionam dentro do runtime do Next.js, ex. geração de
      PDF na Parte 06) — confirmado que o quarto já escolhido por uma
      camareira foi corretamente preservado (`skipped`), e os demais
      quartos receberam o tipo de trabalho certo, batendo com o cálculo
      feito à parte num script isolado antes da integração.
    - **Sincronização de Chegadas & Saídas e Mesas do Café implementadas
      na Parte 13** (ver abaixo). **Ainda não implementado**: automação por
      cron (Vercel Cron) — por ora toda sincronização é sempre manual, via
      botão em cada tela.
19. **Parte 12 — Renomeação "Quarto" → "Suíte" e alocação de suítes no
    layout de mesas** (16/09/2026, feita direto em `main`, pós parte 11):
    - **Todo texto visível ao usuário que dizia "Quarto"/"quarto" virou
      "Suíte"/"suíte"** em todo o app — menus, títulos, placeholders,
      mensagens de erro/toast, e-mail e PDF do recibo. **Deliberadamente
      não renomeado**: identificadores internos (`rooms`, `room_id`,
      `roomId`, o tipo TS `Room`), a rota `/checklists/quartos` e nomes de
      função/componente (ex.: `RoomsTable`) — só o texto exibido mudou, o
      código interno continua em "room"/"quarto" por baixo. Comentários de
      código em português também não foram todos revisados (não são
      visíveis ao usuário; baixa prioridade). Vale como convenção daqui
      pra frente: texto novo voltado ao usuário deve dizer "suíte", nunca
      "quarto".
    - **Layout de mesas (`TableLayoutCanvas`, compartilhado entre admin e
      camareira) ganhou duas mudanças visuais**: cada mesa agora mostra o
      nome de cada suíte alocada nela ("Suíte N") com a quantidade de
      hóspedes correspondente logo abaixo — e mesas ocupadas ficam na
      tonalidade mais clara possível (contra mesas vagas, mais escuras).
      Ver `PRD_regrasdenegocio.md` seção 5 para o requisito completo,
      incluindo a Mesa 7 podendo mostrar mais de uma suíte empilhada.
    - **Nova tabela `daily_breakfast_room_assignments`** (migration
      `030_mesa_suite_assignments.sql`): associa suíte(s) a uma mesa, por
      dia, com a quantidade de hóspedes daquela suíte especificamente —
      única por (date, room_id): uma suíte só pode estar numa mesa por
      vez, sem impedir a Mesa 7 de ter várias linhas (uma por suíte).
      **Decisão importante**: essa tabela **não substitui nem realimenta
      automaticamente** `daily_breakfast.guest_count` (o total manual já
      editado pela tela, que segue comandando a comissão) — são dois
      campos independentes que o admin preenche separadamente por ora.
      Risco aceito conscientemente: os dois podem ficar
      inconsistentes entre si (nada valida que a soma das suítes bate com
      o total digitado) — populá-los a partir da mesma fonte (a futura
      sincronização "Mesas do Café" da Stays, ainda não implementada — ver
      Parte 11) resolveria isso, mas está fora do escopo desta parte.
    - **UI do admin** (`guests-admin-panel.tsx`, componente
      `TableRoomAssignments`): dentro de cada card de mesa, uma
      lista das suítes já alocadas ali (com botão de remover) e um
      seletor pra adicionar mais uma — o seletor só oferece suítes ainda
      **não** alocadas em nenhuma mesa naquele dia (calculado a partir de
      todas as `assignments` do dia, não só as da mesa em questão), pra
      não deixar duplicar uma suíte em duas mesas ao mesmo tempo (também
      garantido no banco pela constraint `unique(date, room_id)`).
20. **Parte 13 — Sincronização de Chegadas & Saídas e Mesas do Café com a
    Stays** (16/09/2026, feita direto em `main`, pós parte 12): completa as
    duas peças que a Parte 11 tinha deixado pendentes, cada uma com seu
    próprio botão "Sincronizar com a Stays" na respectiva tela do admin
    (mesmo padrão do Planejamento Diário).
    - **Chegadas & Saídas** (`syncStaysArrivalsDepartures`, em
      `src/lib/actions/stays-sync.ts`): o nome do hóspede não vem no
      payload da reserva — precisa de uma chamada extra por reserva a
      `GET /external/v1/booking/clients/{_idclient}` (`getStaysClientName`
      em `src/lib/stays/client.ts`), cujo campo `name` já vem pronto como
      "Nome Sobrenome". As respostas são cacheadas em memória durante a
      sincronização (por `_idclient`) pra não repetir a chamada à toa.
      Noites e hóspedes vêm direto da reserva (`checkInDate`/`checkOutDate`/
      `guests`). Chegada sincroniza quando `checkInDate === data`; saída
      quando `checkOutDate === data` — só a existência da linha é
      sincronizada pro caso de saída (não há outro campo). `stays_locked`
      grava true sempre que o admin cria manualmente (`createArrival`/
      `createDeparture`) ou edita um campo sincronizável (`updateArrival`
      só trava se nome/noites/hóspedes mudou — editar só horário
      previsto/observações nunca trava, conforme a exceção do PRD seção 3).
    - **Mesas do Café** (`syncStaysBreakfastTables`, mesmo arquivo): decide
      quais suítes estão ocupadas num dia (`checkInDate < data <=
      checkOutDate` — inclui quem sai naquele dia, já que toma café antes
      de ir embora; exclui quem chega naquele dia, que só terá café no dia
      seguinte) e roda o algoritmo de distribuição por
      proximidade da vista do mar (`src/lib/stays/derive-breakfast.ts`,
      função pura `assignRoomsToTables`, verificada com casos sintéticos
      antes de integrar — mesmo rigor já usado para `trocaNights` na Parte
      11): suítes de 3 hóspedes vão pra Mesa 1 (a primeira) e Mesa 7 (as
      demais); suítes de 1-2 hóspedes preenchem as "mesas normais" (2, 3,
      4, 5, 6, 8, 9) na ordem 5→9→3→4→8→2→6; qualquer sobra que não coube
      em lugar nenhum vai pra Mesa 7 como última alternativa. Grava o
      resultado em `daily_breakfast_room_assignments` **e** soma os
      hóspedes por mesa pra `daily_breakfast.guest_count` (resolvendo o
      risco de inconsistência entre os dois campos, já apontado como
      pendente na Parte 12) — cada um respeitando seu próprio
      `stays_locked`.
    - **Nova coluna `daily_breakfast_room_assignments.stays_locked`**
      (migration `031_breakfast_assignment_lock.sql`): quando o admin
      atribui/move uma suíte manualmente (`setTableRoomAssignment`), a
      linha trava e a sincronização passa a ignorá-la, preservando a
      escolha do admin pro resto do dia (regra de preferência do PRD seção
      1). **Limitação conhecida, aceita conscientemente por ora**: o
      botão de remover uma alocação (`removeTableRoomAssignment`) não deixa
      nenhum rastro de que aquela suíte foi removida de propósito — como a
      linha simplesmente deixa de existir, a próxima sincronização pode
      recriá-la se a suíte continuar ocupada segundo a Stays. Contornável
      na prática movendo a suíte pra outra mesa em vez de só removê-la
      (isso sim trava). Resolver de verdade exigiria uma "lápide" (linha
      marcando "suíte X removida de propósito no dia Y"), deixado de fora
      por ora por não ter sido pedido e por adicionar complexidade nova ao
      modelo de dados.
    - **Testado com dados reais da API de produção da Stays**, mesmo
      truque de rota de API temporária + bypass temporário do middleware já
      usado na Parte 11 (e antes, na Parte 06 pra PDF) — confirmado
      chegadas com nome/noites/hóspedes corretos e mesas distribuídas na
      ordem esperada, ambos limpos do código depois do teste.
    - **Não implementado nesta parte** (documentado como pendência menor em
      `PRD_regrasdenegocio.md` seção 4): os quatro campos novos de
      `daily_breakfast_settings` (quantidade de mesas de 1/2/3 hóspedes,
      hóspedes na Mesa 07) — as colunas já existem (Parte 11) mas ainda não
      têm sincronização nem tela de edição própria.
21. **Parte 14 — Cron de sincronização automática, sincronização manual
    forçada e UI dos 4 campos de contagem de mesas** (16/09/2026, feita
    direto em `main`, pós parte 13):
    - **Sincronização automática por Vercel Cron**: novo endpoint
      `src/app/api/cron/stays-sync/route.ts` (GET) chama, em sequência,
      `syncStaysPlanning`, `syncStaysArrivalsDepartures` e
      `syncStaysBreakfastTables` **sem** `force` — ou seja, respeita a
      regra de preferência normalmente, exatamente como se fosse mais um
      clique nos três botões antigos. Configurado em `vercel.json`
      (`crons: [{ path: "/api/cron/stays-sync", schedule: "0 9 * * *" }]`
      — todo dia às 9h UTC, ~6h em Brasília, antes do início do
      expediente). Protegido pelo padrão recomendado pela própria Vercel:
      checa `Authorization: Bearer ${CRON_SECRET}`, responde 401 sem essa
      variável configurada ou com valor errado — nunca roda "aberto".
      **Assumido plano Hobby** (nenhum "team" encontrado na conta Vercel
      via API): só 1 execução por dia é garantida nesse plano; se o
      proprietário estiver num plano Pro, pode editar `vercel.json` pra
      rodar com mais frequência (ex.: `"0 * * * *"`, de hora em hora).
    - **`src/lib/supabase/middleware.ts` (proxy)**: `/api/cron/*`
      adicionado ao `isPublic` — sem isso, o proxy redirecionaria a
      chamada do Vercel Cron (que não manda cookie de sessão nenhum) pra
      `/login` antes mesmo de chegar no endpoint. A autenticação de quem
      pode chamar essa rota passa a ser inteiramente o `CRON_SECRET`, não
      mais a sessão do Supabase.
    - **`CRON_SECRET` gerado e gravado** em `.env.local`/`.env.local.cloud`
      (valor aleatório de 32 bytes) — **ainda precisa ser adicionado
      manualmente nas variáveis de ambiente do projeto na Vercel**
      (Settings → Environment Variables → Production, e Redeploy depois),
      do contrário o cron sempre vai falhar com 401 em produção (o app
      local/testes continuam funcionando normalmente sem isso, já que só
      afeta esse endpoint específico).
    - **Os três botões "Sincronizar com a Stays" viraram "Forçar
      sincronização com a Stays"**: agora chamam as três Server Actions
      com `{ force: true }` (novo parâmetro `SyncOptions` em
      `src/lib/actions/stays-sync.ts`) — passam a **ignorar**
      `stays_locked` em vez de respeitá-lo, sobrescrevendo qualquer edição
      manual do admin com os dados atuais da Stays. Cada botão tem um
      `confirm()` explicando isso antes de executar (mesmo padrão já usado
      pelo `DeleteButton` de Chegadas & Saídas). **O que `force` nunca
      ignora**: um serviço do Planejamento Diário já reivindicado
      (`assigned_to` preenchido) ou fora do status `pendente` — isso é
      trabalho em curso de uma camareira, não a "preferência de edição do
      admin" que o botão força; continua protegido em qualquer cenário.
    - **Os 4 campos de contagem por tamanho de mesa ganharam sincronização
      e tela** (pendência apontada na Parte 13): `syncStaysBreakfastTables`
      agora também calcula, a partir do mesmo resultado do algoritmo de
      distribuição, quantas mesas ficaram com exatamente 1/2/3 hóspedes e
      quantos hóspedes têm na Mesa 07 (`tableNumber`, exportada de
      `derive-breakfast.ts`, identifica a Mesa 07 pelo rótulo), e grava em
      `daily_breakfast_settings` respeitando o `stays_locked` da própria
      linha de configurações do dia. Nova Server Action
      `setBreakfastTableCounts` (`src/lib/actions/tables.ts`) grava a
      edição manual do admin, marcando `stays_locked = true` — diferente
      de `setBreakfastDaySettings` (total de mesas + observação do dia),
      que nunca toca esse campo, pois nenhum dos dois vem da Stays. Na UI
      (`guests-admin-panel.tsx`), os 4 campos aparecem exatamente na
      ordem pedida: logo abaixo de "Total de mesas", logo acima de
      "Observação do dia". Na tela da camareira (`(camareira)/mesas/page.tsx`),
      aparecem só leitura, na mesma posição.
    - **Testado localmente**: sincronização forçada sobre um valor travado
      manualmente (`stays_locked = true` + valor divergente gravado direto
      no banco) confirmou que uma chamada sem `force` preserva o valor
      travado, e a mesma chamada com `force: true` sobrescreve com o valor
      correto e destrava a linha (`stays_locked` volta a `false`) — mesmo
      truque de rota de API temporária já usado nas partes anteriores,
      removida depois do teste. O endpoint de cron também foi testado
      diretamente (401 sem `Authorization`/com valor errado, 200 com o
      `CRON_SECRET` certo, sincronizando as três telas numa só chamada).
22. **Parte 15 — "Lápides" de exclusão: apagar sem perder a regra de
    preferência** (17/09/2026, feita direto em `main`, pós parte 14):
    corrige de vez as duas limitações que a Parte 13 tinha documentado
    como aceitas conscientemente — o admin pode apagar (Planejamento
    Diário: "Sem trabalho"; Mesas do Café: remover suíte de uma mesa sem
    realocar) e essa decisão passa a obedecer a regra de preferência do
    PRD (seção 1) mesmo sem sobrar nenhuma linha viva pra carregar um
    `stays_locked`.
    - **O problema de fundo**: `stays_locked` é uma coluna *dentro* da
      linha que o admin editou. Quando a edição do admin é "apagar a
      linha" (não "mudar um valor"), não sobra onde gravar a preferência
      — a próxima sincronização via cron ou o botão "Forçar sincronização"
      recriava a linha do zero, como se o admin nunca tivesse decidido
      nada.
    - **Solução: duas tabelas "lápide"** (migration
      `032_admin_exclusion_tombstones.sql`), cada uma só com
      `(date, room_id)` como chave primária — não guardam mais nada além
      de quem/quando excluiu, só precisam **existir** pra a sincronização
      saber que aquela suíte/dia foi excluída de propósito:
      `daily_room_task_exclusions` (Planejamento Diário) e
      `daily_breakfast_room_exclusions` (Mesas do Café). RLS: qualquer
      autenticado lê, só admin grava/apaga (mesmo padrão de sempre) — só
      insert/delete, nunca update, porque não há campo pra mudar.
    - **`setRoomTask(date, roomId, null)`** ("Sem trabalho" escolhido no
      Planejamento Diário, `src/lib/actions/planning.ts`): além de apagar
      a linha de `daily_room_tasks` como já fazia, agora também grava uma
      lápide em `daily_room_task_exclusions`. Escolher um tipo de trabalho
      de verdade depois **remove** a lápide (o admin não quer mais excluir
      essa suíte).
    - **`removeTableRoomAssignment(date, roomId)`** (botão "×" nas
      Mesas do Café, `src/lib/actions/tables.ts`): mesma ideia — apaga a
      linha de `daily_breakfast_room_assignments` e grava uma lápide em
      `daily_breakfast_room_exclusions`. `setTableRoomAssignment`
      (escolher/mover a suíte pra uma mesa) remove a lápide, se houver.
    - **`syncStaysPlanning`/`syncStaysBreakfastTables`** (`stays-sync.ts`):
      antes de criar uma tarefa/alocar uma suíte, checam se existe lápide
      pra aquela suíte/dia — se existir e não for `force`, pulam (conta
      como `skipped`, igual a um `stays_locked`). Com `force: true`, a
      lápide é ignorada **e apagada** assim que uma tarefa/alocação de
      verdade é criada no lugar — decisão confirmada explicitamente com o
      proprietário: "forçar" significa "ignore toda a minha preferência,
      confie 100% na Stays agora", incluindo as exclusões, não só o
      `stays_locked` comum. Sem `force`, uma lápide nunca é tocada.
    - **Testado localmente**: lápide gravada manualmente pra uma suíte com
      reserva ativa amanhã — sincronização normal preservou a exclusão
      (nenhuma tarefa/alocação criada); a mesma chamada com `force: true`
      criou a tarefa/alocação de verdade e apagou a lápide correspondente.
      Mesmo truque de rota de API temporária das partes anteriores,
      removida depois do teste.
23. **Parte 16 — Os 4 campos de contagem de mesas viraram calculados, não
    sincronizados** (17/09/2026, feita direto em `main`, pós parte 15):
    revisão de decisão pedida pelo proprietário depois de ver a Parte 14
    em produção — os quatro campos (quantidade de mesas de 1/2/3 hóspedes,
    hóspedes na Mesa 07) eram gravados em `daily_breakfast_settings` só
    quando o admin clicava "Forçar sincronização" ou os editava manualmente,
    o que os deixava desatualizados sempre que uma suíte era realocada
    entre mesas sem passar por ali. Solução mais simples: eliminar a
    persistência inteira e **calcular na hora**, sempre, a partir de
    `daily_breakfast_room_assignments` — a fonte de verdade já existente.
    - **`computeTableSizeCounts`** (nova função pura em
      `src/lib/stays/derive-breakfast.ts`, ao lado de `assignRoomsToTables`
      /`tableNumber`, que ela reaproveita): recebe as alocações do dia +
      as mesas ativas, devolve os 4 números. Chamada tanto por
      `guests-admin-panel.tsx` (admin, dentro de `GuestCountEditor`) quanto
      por `(camareira)/mesas/page.tsx` (`DaySettingsInfo`) — os dois já
      tinham `assignments`/`tables` disponíveis, não precisou de fetch novo.
    - **Os 4 campos viraram somente leitura nas duas telas** (antes eram
      editáveis pelo admin) — não faz sentido editar manualmente um valor
      que é sempre recalculado a partir de outra fonte.
    - **Removido**: a Server Action `setBreakfastTableCounts`
      (`src/lib/actions/tables.ts`), o bloco de `syncStaysBreakfastTables`
      que gravava esses 4 campos em `daily_breakfast_settings` (a soma por
      mesa pra `daily_breakfast.guest_count` continua existindo, só o
      detalhamento por tamanho é que não persiste mais), e as próprias
      colunas do banco (`tables_1_guest`/`tables_2_guest`/`tables_3_guest`/
      `guests_table_07`/`stays_locked` de `daily_breakfast_settings` —
      migration `033_drop_unused_breakfast_settings_columns.sql`; nunca
      chegaram a ser editadas de verdade por um admin, só por código de
      sincronização já removido, então descartar foi seguro).
    - **Também removida, a pedido**: a linha "Total de mesas ocupadas ·
      Total de hóspedes" que aparecia no fim do `GuestCountEditor` (tela do
      admin), logo antes dos cards "Mesas · hoje/amanhã" — considerada
      redundante depois que os 4 campos de contagem já mostram esse
      detalhamento de forma mais útil.
24. **Parte 17 — "Total de mesas" também virou calculado** (17/09/2026,
    feita direto em `main`, pós parte 16): extensão direta da Parte 16,
    pedida pelo proprietário ao notar que "Total de mesas" — até então um
    seletor manual (0 até o total de mesas ativas) — deveria significar a
    mesma coisa que "Total de mesas ocupadas" já significava (quantas
    mesas precisam ser postas pro café, dado quem está hospedado): por
    exemplo, 1 suíte de 1 hóspede + 5 suítes de 2 hóspedes = 6 mesas.
    - **`computeTableSizeCounts`** (`src/lib/stays/derive-breakfast.ts`)
      ganhou um quinto campo, `totalOccupiedTables`: conta quantas mesas
      têm pelo menos 1 hóspede somado entre as suítes alocadas nelas —
      não é só a soma dos outros quatro contadores (que só cobrem mesas de
      exatamente 1/2/3 hóspedes), cobre também mesas com mais de 3 (ex.:
      Mesa 7 com duas suítes de 3 hóspedes cada, 6 no total).
    - **O seletor manual de "Total de mesas" saiu da tela do admin**
      (`guests-admin-panel.tsx`) — agora é só mais uma linha somente
      leitura, junto dos outros 4 campos, todas na mesma ordem do PRD.
    - **`daily_breakfast_settings` perdeu a coluna `total_tables`**
      (migration `034_drop_total_tables_column.sql`) — a tabela agora só
      guarda `date`/`notes`/`updated_at` (observação do dia, o único campo
      que sobrou nela). `setBreakfastDaySettings` foi renomeada pra
      `setBreakfastDayNotes(date, notes)`, já que não recebe mais
      `totalTables` como parâmetro.
25. **Parte 18 — Tela "Questões e Respostas" para o admin** (17/09/2026,
    feita direto em `main`, pós parte 17): pedida porque quem vai operar o
    app no dia a dia não é necessariamente quem participou de construí-lo
    — é um guia de referência, em linguagem simples (sem jargão técnico),
    explicando as 10 funcionalidades mais importantes pra quem supervisiona
    o sistema, em formato de perguntas e respostas.
    - **Rota nova**: `src/app/(admin)/questoes-respostas/page.tsx`, um
      componente só de conteúdo estático (sem busca no banco) — um
      `Accordion` com 10 itens. Adicionada ao menu principal do admin
      (`src/components/shared/app-sidebar.tsx`) logo depois de "Histórico",
      e ao `adminOnlyPrefixes` do proxy (`src/lib/supabase/middleware.ts`)
      pra ficar restrita ao papel admin.
    - **Conteúdo**: começa pela integração com a Stays (como funciona a
      sincronização automática diária, o botão "Forçar sincronização" e o
      que acontece ao editar manualmente um campo sincronizado, com
      exemplos, terminando na lista completa dos campos sincronizados e
      editáveis) e segue com mais 9 tópicos (Planejamento Diário, Chegadas
      & Saídas, Mesas do Café, Bar e Frigobar/Comandas, Ocorrências de
      Manutenção, Manutenção Preventiva, Usuários, Resumo Executivo e
      Histórico) — sempre em linguagem não técnica, com exemplos práticos.
    - **Manutenção futura**: como é conteúdo escrito à mão (não gerado a
      partir do código), sempre que uma parte futura mudar uma dessas 10
      funcionalidades de um jeito que o admin perceberia, vale revisar essa
      página também — ela pode ficar desatualizada silenciosamente, ao
      contrário do resto do app.
26. **Parte 19 — Camareira só vê "hoje" em Mesas do café/Chegadas & saídas,
    e ajuste de layout dos cards de "Minhas suítes"** (17/09/2026, feita
    direto em `main`, pós parte 18):
    - **`(camareira)/mesas/page.tsx` e `(camareira)/chegadas-saidas/page.tsx`
      perderam as abas "Hoje"/"Amanhã"** — a camareira só precisa do dia
      corrente pra essas duas telas (o admin continua vendo os dois dias
      nas telas de gerenciamento, `mesas/gerenciar` e
      `chegadas-saidas/gerenciar`, sem mudança nenhuma ali). As páginas
      buscam só os dados de hoje agora, sem o segundo conjunto de queries
      pra amanhã.
    - **Correção de layout nos cards de "Disponíveis para escolher"**
      (`(camareira)/tarefas/tasks-board.tsx`, `AvailableTaskCard`): antes,
      o nome da suíte, o tipo de serviço e os botões "Cancelar"/"Escolher"
      disputavam a mesma linha, e num card estreito (celular) isso
      quebrava de forma feia — texto sobreposto, número da suíte pulando
      de linha. Reestruturado em duas linhas fixas: a primeira só com
      ícone + "Suíte N" (com `whitespace-nowrap`, nunca quebra) + os
      botões; a segunda, abaixo e alinhada com o nome da suíte, com o tipo
      de serviço (e a data, nos cards de "Serviços anteriores"). O botão
      "Escolher" ficou mais estreito: o ícone da mãozinha agora fica
      empilhado *acima* da palavra "Escolher" (`flex-col`), em vez de lado
      a lado, sobrando mais espaço horizontal pro nome da suíte.
      **Ajuste fino no mesmo card, ainda no mesmo dia**: essa primeira
      correção não foi suficiente em telas bem estreitas (o nome da suíte
      ainda sobrepunha o botão "Cancelar") — o ícone circular de cama
      (`BedDouble`) foi removido do card, com o nome da suíte ("Suíte N",
      agora com `truncate` de verdade — corta com reticências em vez de
      vazar por cima do vizinho) ocupando esse espaço; o botão "Cancelar"
      passou a ter exatamente o mesmo formato empilhado do "Escolher" (um
      X no lugar da mãozinha); e o separador "·" entre o tipo de serviço e
      a data (nos cards de "Serviços anteriores") foi removido — ficou só
      um espaço entre os dois.
27. **Parte 20 — Cores de mesa ocupada/vaga invertidas, com receita própria
    por tema** (17/09/2026, feita direto em `main`, pós parte 19): pedido
    do proprietário pra inverter qual estado (ocupada/vaga) recebe a cor de
    destaque, com uma combinação diferente pra cada um dos 3 temas —
    diferente de tudo que existia até aqui no app, que só distinguia "claro"
    de "escuro" (os dois temas escuros sempre usavam exatamente as mesmas
    cores entre si).
    - **Duas variantes novas do Tailwind, em `src/app/globals.css`**:
      `theme-bordo` (`&:is(.dark *)`) e `theme-blue` (`&:is(.dark-blue *)`)
      — ao lado da já existente `dark` (que continua cobrindo os dois temas
      escuros juntos, `&:is(.dark *, .dark-blue *)`, usada em todo o
      resto do app). Como o tema é uma classe única aplicada no `<html>`
      pelo `next-themes` (`light`/`dark`/`dark-blue`, nunca duas ao mesmo
      tempo), essas duas variantes nunca conflitam entre si — só precisam
      ser usadas juntas quando um componente, como o layout de mesas, quer
      cores diferentes entre os dois escuros.
    - **`table-layout-canvas.tsx`**: mesa ocupada agora é a que recebe a
      cor de destaque (antes era o contrário — "tonalidade mais clara
      possível", pedido original da Parte 12):
      - Claro: ocupada = azul sólido (`bg-secondary`) + fonte clara; vaga =
        azul bem clarinho (`bg-secondary/30`) + fonte escura.
      - Escuro azul: ocupada = um azul mais escuro que o fundo da tela
        (`#262D45` vs. `--background: #3B4564`) + fonte clara; vaga = um
        azul só um pouco mais claro que o fundo (`#4C577A`) + fonte clara
        (nunca chega a clarear o bastante pra precisar de fonte escura —
        pedido explícito do proprietário pra não usar fundo claro aqui).
      - Escuro bordô: ocupada = um bordô bem mais escuro que o fundo
        (`#2A0D10` vs. `--background: #5A2025`) + fonte clara; vaga = um
        bordô bem mais claro que o fundo, quase rosado (`#E6C6C8`) + fonte
        escura (`#5A2025`, a própria cor bordô do tema, reaproveitada como
        texto por já ter bom contraste ali).
    - **Verificado direto no CSS gerado** (não só que o build passou): o
      seletor `.theme-bordo\:bg-\[\#2A0D10\]:is(.dark *)` saiu exatamente
      como esperado, com a mesma "forma"/especificidade do `dark:` que já
      funcionava — evitou depender só de "o build não quebrou" pra validar
      uma técnica de CSS nova no projeto.
28. **Parte 21 — Aba "Hoje" sempre como padrão, e ajustes de layout
    (posição do seletor Hoje/Amanhã, botão "+ Nova chegada")** (17/09/2026,
    feita direto em `main`, pós parte 20):
    - **Planejamento Diário e Chegadas & Saídas passaram a default "Hoje"**
      (`planejamento/page.tsx`, `chegadas-saidas/gerenciar/page.tsx`):
      antes, na ausência do parâmetro `?date=` na URL, essas duas telas
      caíam em `tomorrowKey()` — ou seja, o padrão de fato era "Amanhã",
      contradizendo o que o próprio `PRD_regrasdenegocio.md` seção 1 já
      dizia ("o padrão é sempre a aba Hoje"). Corrigido invertendo a
      lógica: agora só mostra "Amanhã" quando `sp.date === "amanha"`
      explicitamente; qualquer outra coisa (inclusive ausência do
      parâmetro) cai em "Hoje". Como a URL não carrega esse parâmetro ao
      navegar por um link do menu, sair da tela e voltar já mostra "Hoje"
      de novo naturalmente.
    - **Mesas do Café já defaultava "Hoje" corretamente** — usa um
      `<Tabs defaultValue="hoje">` do lado do cliente, sem depender de
      parâmetro de URL nenhum, então já reiniciava em "Hoje" a cada vez
      que a tela era carregada. PRD seção 1 tinha uma exceção documentada
      dizendo que essa tela devia default pra "Amanhã" — removida agora
      (a pedido do proprietário, pra ficar igual às outras duas telas).
    - **Seletor "Hoje/Amanhã" movido pra baixo do botão "Forçar
      sincronização com a Stays"** nas duas telas acima — antes ficavam
      lado a lado na mesma linha do cabeçalho, empilhados agora
      (`flex-col items-end` no lugar de `flex items-center`).
    - **Botão "+ Nova chegada"/"+ Nova saída" cortando na borda do card no
      celular** (`arrivals-departures-panel.tsx`): o cabeçalho do card
      (`CardHeader`) não deixava o título e o botão quebrarem linha
      quando não cabiam lado a lado — adicionado `flex-wrap` (+ `gap-2`
      no lugar do `gap-1` implícito) nos dois `CardHeader` (Chegadas e
      Saídas), deixando o botão cair pra uma segunda linha em telas
      estreitas em vez de ficar espremido/cortado.
29. **Parte 22 — Duração de serviço: Início/Término no Resumo Executivo e
    Duração média no Histórico** (17/09/2026, feita direto em `main`, pós
    parte 21):
    - Nova coluna `daily_room_tasks.claimed_at` (migration
      `035_daily_room_tasks_claimed_at.sql`): grava o momento em que a
      camareira reivindica um serviço (clique em "Escolher") — diferente
      de `started_at` (já existente, grava o primeiro toque num item do
      checklist). `claimTask` (`src/lib/actions/tasks.ts`) passou a
      gravar esse timestamp junto com `assigned_to`.
    - Card "Serviços dos últimos 7 dias" (Resumo Executivo) ganhou colunas
      Início/Término/Duração (Duração = Término − Início, só hora:minuto,
      já que a data aparece em outra coluna) — `src/app/(admin)/dashboard/
      service-log-table.tsx`. Linhas de serviço **cancelado** saíram da
      lista, que agora mostra só concluídos.
    - Histórico > Por camareira ganhou "Duração média" (mesma fórmula,
      agregada por camareira).
    - Serviços concluídos antes de `claimed_at` existir (sem valor nessa
      coluna) usam `started_at` como aproximação de início, tanto na
      exibição quanto no cálculo de duração/média — pra não ficarem com
      "—" indefinidamente; serviços novos sempre têm `claimed_at` real.
    - Helpers `formatDurationPt`/`durationMinutes`/`formatMinutesPt` em
      `src/lib/date.ts`.
30. **Parte 23 — Correção da sincronização perdendo saídas cujo check-out é
    exatamente hoje** (19/09/2026, feita direto em `main`, pós parte 22):
    - **Bug real descoberto em produção**: a Stays só considera uma
      reserva "incluída" (`dateType=included`) num intervalo consultado se
      pelo menos uma noite dela começa dentro desse intervalo — uma
      reserva com check-out hoje não tem nenhuma noite começando hoje,
      então a API nunca a devolvia quando a sincronização buscava a partir
      de `from=hoje`. Isso fazia a suíte sumir do Planejamento Diário
      (virava "Sem trabalho" incorretamente), da lista de Saídas em
      Chegadas & Saídas, e da alocação de mesas do café (hóspede que sai
      hoje ainda toma café antes de partir).
    - Corrigido nas três sincronizações (`syncStaysPlanning`,
      `syncStaysArrivalsDepartures`, `syncStaysBreakfastTables`, em
      `src/lib/actions/stays-sync.ts`) buscando reservas a partir de
      **ontem**, não de hoje — não foi preciso alargar o lado de "amanhã",
      já que um check-in em amanhã sempre tem a primeira noite dele
      começando em amanhã. `resolveGuestCountForAssignment`
      (`src/lib/actions/tables.ts`, Parte 26/27) já buscava a partir de
      ontem por esse mesmo motivo, documentado ali antes até de o bug ser
      corrigido nas sincronizações.
    - Verificado direto contra a API real da Stays antes da correção, e
      testado localmente depois.
31. **Parte 24 — Regras finas de alocação de mesas, consumo/ocorrências no
    detalhe do admin, e cancelar escolha de suíte** (19/09/2026, feita
    direto em `main`, pós parte 23 — três mudanças não relacionadas entre
    si, pedidas pelo proprietário na mesma leva):
    - **Mesas do café**: refinamento do algoritmo de distribuição
      (`assignRoomsToTables`, `src/lib/stays/derive-breakfast.ts`) —
      suítes 10 e 11, quando ocupadas, têm preferência pelas Mesas 5 e 9
      (mais perto da vista do mar); na ausência delas, a preferência passa
      a ser de uma suíte de 1 hóspede. Mesa 7 passa a ser a **única** mesa
      que pode reunir mais de uma suíte — todas as outras ficam
      reservadas inteiras pra uma única suíte (mesmo que sobre
      capacidade), evitando juntar duas suítes de 1 hóspede numa mesma
      mesa normal; só em superlotação real (mais suítes do que mesas
      comportam) esse limite é quebrado, e só na Mesa 7. Verificado com
      casos sintéticos e testado contra dados reais antes de integrar.
    - **Resumo Executivo > detalhe de um serviço concluído**
      (`/dashboard/tarefas/[taskId]`): passou a mostrar o consumo de
      frigobar/bar da suíte (retrato da conta vigente naquele dia, mesmo
      formato da tela "Consumo por quartos") — **reverte a decisão
      explícita da Parte 10**, que tinha deixado essa seção de fora de
      propósito porque o frigobar é por conta corrente, não por
      tarefa/dia, e mostrar "o frigobar de hoje" rotulado como "o que a
      camareira preencheu naquele dia" seria dado errado sempre que a
      conta já tivesse girado. Essa ressalva continua valendo tecnicamente
      (o consumo mostrado é sempre o da conta **atual**, não um retrato
      congelado do dia do serviço) — o proprietário pediu a mudança
      ciente disso. A tela também passou a deixar explícito quando não há
      nenhuma ocorrência de manutenção ou observação registrada (antes a
      seção simplesmente não aparecia).
    - **Cancelar escolha de suíte**: a camareira pode cancelar a própria
      escolha de uma suíte já reivindicada, antes de finalizar
      (`cancelClaim`/`cancel_own_claimed_task`, migration
      `036_cancel_own_claimed_task.sql`, função `security definer`
      seguindo o padrão já estabelecido): o serviço volta pra lista de
      disponíveis, e tudo que tinha sido preenchido nessa tentativa
      (itens do checklist marcados, ocorrências, observação) é apagado —
      como se a suíte nunca tivesse sido escolhida. Diferente de
      `cancel_daily_room_task` (Parte 10, migration 028), que só cancela
      um serviço **pendente** de dia anterior, ainda não reivindicado por
      ninguém.
32. **Parte 25 — Lançamento de frigobar sempre aditivo** (20/09/2026, feita
    direto em `main`, pós parte 24 — duas iterações no mesmo dia, a
    segunda substituindo o modelo da primeira a pedido do proprietário):
    - **Primeira tentativa**: contas ainda abertas ganharam um seletor
      "Houve consumo no último dia?" — ao marcar "sim", apareciam os
      mesmos steppers já usados na conta reaberta.
    - **Redesenhada no mesmo dia**, a pedido explícito do proprietário
      ("vamos abandonar essa ideia de consumo do último dia... renomeando
      a seleção para 'Lançar consumo adicional'"). Modelo final, em
      `src/app/(camareira)/bar-piscina/consumo-quartos-panel.tsx`: com a
      conta **aberta**, a camareira pode ligar "Lançar consumo adicional"
      — nasce sempre desligado, não reflete consumo pré-existente — pra
      somar mais alguma coisa antes de fechar a conta pela primeira vez.
      Com a conta **reaberta** (pra corrigir algo), a edição já fica
      sempre disponível e **soma por padrão** ao que já existe; só
      virando explicitamente "zerar e lançar tudo novamente" (com
      `confirm()`, já que apaga o consumo lançado) é que a base zera pra
      recomeçar do zero. Essa escolha nunca é persistida — cada novo
      ciclo fechar → reabrir volta sempre ao padrão aditivo.
    - Implementado com um par `baseQty`/`additionalQty`: o stepper mostra
      só o delta sendo adicionado agora (autônomo, sempre começa em
      zero); o valor salvo em cada clique é sempre `base + delta`. Reset
      do modo "integral" ao detectar uma reabertura de verdade via o
      padrão já usado no projeto de "ajustar estado durante a
      renderização" (sem `useEffect`).
33. **Parte 26 — Alocação de suítes por mesa direto no layout, e
    sincronização não-forçada sob demanda** (20/09/2026, feita direto em
    `main`, pós parte 25):
    - **Mesas do café (admin)**: clicar numa mesa no layout "Mesas ·
      hoje/amanhã" abre `TableAssignmentDialog`
      (`src/app/(admin)/mesas/gerenciar/table-assignment-dialog.tsx`) com
      as suítes alocadas ali (adicionar/remover) — substitui os antigos
      seletores dentro de cada card de mesa, que foram removidos (o
      componente `TableRoomAssignments` da Parte 12 não existe mais). O
      sistema rejeita lançar mais hóspedes do que a mesa comporta.
    - Mesas com alguma suíte alocada manualmente pelo admin
      (`stays_locked`) ficam sempre em amarelo claro com letra escura no
      layout (`editedTableIds`, `table-layout-canvas.tsx`), sobrepondo a
      cor normal de ocupada/vaga do tema — só na visão do admin; a
      camareira nunca vê esse destaque (não recebe a prop
      `editedTableIds`), então não distingue mesa editada de mesa alocada
      pelo sistema.
    - Planejamento Diário, Chegadas & Saídas e Mesas do Café ganharam um
      segundo botão de sincronização, **"Sincronizar agora (preserva
      edições)"**: roda a sincronização com a Stays imediatamente (sem
      esperar o cron do dia), mas nunca sobrescreve nada que o admin já
      editou hoje/amanhã — só preenche o que ainda está do jeito que a
      Stays sugere. Complementa (não substitui) o botão "Forçar
      sincronização", que continua ignorando as edições de propósito.
      Ambos chamam a mesma Server Action, só mudando `{ force: true/false
      }`.
34. **Parte 27 — Comissão por suíte elegível ao café, não por mesa, com
    congelamento histórico** (20/09/2026, feita direto em `main`, pós
    parte 26 — quatro iterações na mesma leva, cada uma corrigindo um
    defeito de design da anterior):
    - **Decisão de fundo, pedida explicitamente pelo proprietário**: a
      comissão do dia deixou de depender de quantos hóspedes o admin
      digitava por mesa (sinal indireto de "mesa ocupada") e passou a ser
      puramente "quantidade de suítes elegíveis pro café da manhã" (mesma
      regra já usada pra decidir quais suítes ocupar nas mesas:
      `checkInDate < data <= checkOutDate`) × "Valor da comissão por café
      servido" (campo renomeado de "por mesa"). O diálogo de suítes por
      mesa (Parte 26) perdeu o campo de digitar quantidade de hóspedes —
      a quantidade agora é sempre resolvida no servidor
      (`resolveGuestCountForAssignment`, `src/lib/actions/tables.ts`):
      reaproveita o valor já conhecido se a suíte só está sendo movida,
      ou busca a reserva vigente na Stays se for alocação nova.
    - **Primeira versão**: comissão calculada a partir de
      `daily_breakfast_room_assignments` (quantas suítes foram de fato
      alocadas a alguma mesa). **Corrigida logo em seguida**: essa
      contagem podia ficar errada em caso de superlotação real ou de uma
      suíte excluída por lápide — nenhuma das duas situações deveria
      afetar a comissão, já que a suíte continua elegível mesmo sem estar
      sentada em mesa nenhuma. A contagem definitiva
      (`eligible_suites_count`) passou a ser gravada em
      `daily_breakfast_settings` a cada sincronização (automática ou
      forçada), independente de alocação de mesa — junto com o valor de
      comissão vigente naquele momento (`commission_value_snapshot`,
      também em `daily_breakfast_settings`; a coluna equivalente que
      tinha sido criada em `daily_breakfast_room_assignments` na versão
      anterior foi removida). "Hóspedes café" (estatística separada, não
      usada no cálculo) continua somando os hóspedes reais por suíte
      alocada.
    - **Congelamento histórico**: o Histórico usa o
      `commission_value_snapshot` gravado no dia da sincronização pra
      qualquer mês que não seja o corrente — mudar o valor da comissão
      hoje nunca altera meses já fechados. O mês corrente (e o Resumo
      Executivo, que só mostra o mês corrente) sempre usa o valor atual
      do campo.
    - **Fallback pra não zerar o passado**: `eligible_suites_count` virou
      anulável — `null` significa "essa data nunca foi sincronizada sob a
      regra nova" (distinto de `0`, que só passou a significar
      "sincronizada e confirmada zero suítes elegíveis" depois da
      migration `039_eligible_suites_nullable_fallback.sql`). Resumo
      Executivo e Histórico caem pra regra antiga (contagem de
      `daily_breakfast_room_assignments` × valor atual da comissão)
      sempre que `eligible_suites_count` for nulo pra uma data. **Essa
      foi a origem da prática já registrada em "Convenções e decisões
      importantes" abaixo — ver essa seção pro texto completo da regra,
      pedida explicitamente pelo proprietário**: uma mudança de regra de
      cálculo nunca deve zerar retroativamente um valor que já tinha sido
      calculado antes dela existir.
    - Migrations: `037_commission_snapshot_per_suite.sql` (criada e
      depois parcialmente revertida por
      `038_commission_by_eligible_suites.sql`, que moveu o retrato pra
      `daily_breakfast_settings`) e `039_eligible_suites_nullable_fallback.sql`.
35. **Parte 28 — Bugs reais pós-lançamento da Parte 26/27, e alocação de
    qualquer suíte em qualquer mesa** (20/09/2026, feita direto em `main`,
    pós parte 27 — todos corrigidos no mesmo dia em que o proprietário
    reportou os sintomas em produção):
    - **Bug real, causa raiz**: o upsert de `daily_breakfast_room_assignments`
      (dentro de `syncStaysBreakfastTables`) continuava gravando
      `commission_value_snapshot`, coluna que a migration `038` tinha
      removido dessa tabela (mudou pra `daily_breakfast_settings`, Parte
      27) — todo upsert de alocação suíte↔mesa vinha falhando
      silenciosamente desde então (o erro não era checado), fazendo uma
      suíte recém-computada pelo algoritmo sumir sem deixar rastro (linha
      antiga apagada, nova nunca gravada), enquanto o total de hóspedes
      por mesa (calculado à parte) saía certo — sintoma visível em
      produção: uma mesa mostrando "N hóspedes" sem nome de suíte
      nenhuma. Corrigido removendo o campo indevido e passando a checar o
      `error` desse upsert (e dos outros dois da mesma função) — falhas
      agora contam num contador `errors` devolvido pra tela, que avisa se
      algo falhar (`sync-stays-button.tsx`). **Reforça a lição já
      registrada em "Convenções e decisões importantes"**: mesmo uma
      função que já segue a prática de checar `.error` pode ter um call
      site específico esquecido — vale auditar todos os pontos de escrita
      de uma função sempre que uma coluna que ela grava for
      removida/renomeada por uma migration, não só assumir que a prática
      geral já cobre o caso.
    - **Segundo bug relacionado, mesma correção**: o algoritmo de
      distribuição (`assignRoomsToTables`) não sabia quais mesas já
      estavam ocupadas por suítes travadas (`stays_locked`), podendo
      tentar colocar uma suíte nova numa mesa normal (fora a Mesa 7) já
      travada com outra suíte. Corrigido com `tablesAvailableForAlgorithm`
      (`src/lib/actions/stays-sync.ts`): exclui do algoritmo qualquer
      mesa normal com alguma suíte travada, e reduz a capacidade efetiva
      da Mesa 7 (a única compartilhada) pelos hóspedes já travados nela.
    - **Terceiro bug, reportado separadamente pelo proprietário com
      print**: o seletor do diálogo de alocação (Parte 26) escondia
      qualquer suíte já alocada em **alguma** mesa naquele dia, não só na
      mesa aberta no momento — impedindo mover uma suíte de uma mesa pra
      outra pelo próprio diálogo (ela simplesmente não aparecia como
      opção). Corrigido: só as suítes já alocadas na mesa que está sendo
      editada ficam de fora; as demais aparecem, inclusive as que já
      estão em outra mesa (com a dica "(atualmente na Mesa X)"). Escolher
      uma suíte que está noutra mesa a move automaticamente (mesmo
      upsert por data+suíte de sempre) — a mesa de origem fica livre, sem
      nenhuma lápide/marca de "editada" criada ali; só a mesa de destino
      recebe o destaque de mesa editada.
    - **Quarto bug, mesmo dia**: depois de mover uma suíte, a mesa de
      origem continuava mostrando "N hóspedes" — resquício de um
      fallback antigo do layout de mesas (`guestCounts`, lido de
      `daily_breakfast.guest_count`, campo legado só atualizado pela
      sincronização, nunca pelas ações manuais do diálogo). Removido de
      vez: `TableLayoutCanvas` passou a derivar ocupação/hóspedes só de
      `tableRooms` (a alocação suíte↔mesa, sempre atualizada tanto por
      sincronização quanto por edição manual) — uma mesa sem nenhuma
      suíte alocada agora sempre aparece vazia. `daily_breakfast.guest_count`
      continua existindo no banco (ainda gravado pela sincronização), mas
      não é mais lido em lugar nenhum do código.
    - **Testado extensivamente**: sincronização não forçada, forçada, e
      não forçada de novo sobre o resultado limpo (zero erros nas três,
      suítes elegíveis corretamente alocadas, Mesa 7 dividindo suítes sem
      sobra de capacidade, nenhuma mesa normal com mais de uma suíte) —
      reproduzindo o cenário exato de produção no banco local. Mecanismo
      de mover suíte entre mesas verificado com um teste SQL direto. A
      sincronização por cron chama a mesma função sem `force`, então está
      sujeita às mesmas correções.
36. **Parte 29 — Atualização da tela "Questões e Respostas"** (20/09/2026,
    feita direto em `main`, pós parte 28): a tela
    `src/app/(admin)/questoes-respostas/page.tsx` (escrita na Parte 18,
    antes de boa parte do que mudou desde então) tinha ficado desatualizada
    em vários pontos — descrevia a comissão como "por mesa" (já era "por
    suíte elegível" desde a Parte 27), dizia que Mesas do Café abria por
    padrão em "Amanhã" (corrigido pra "Hoje" já na Parte 21, mas o texto
    nunca foi atualizado), descrevia mesa ocupada como "cor mais clara"
    (invertido desde a Parte 20) e "arrastar/reatribuir" suíte por mesa
    (virou um diálogo ao clicar na mesa, Parte 26), não mencionava o
    segundo botão "Sincronizar agora (preserva edições)" (Parte 26), a
    possibilidade de a camareira cancelar a própria escolha (Parte 24), o
    lançamento aditivo de frigobar (Parte 25), nem as colunas de
    Início/Término/Duração (Parte 22). Revisada por completo nesta leva
    pra bater com o estado atual do app. **Lição reforçada**: como o
    conteúdo dessa tela é escrito à mão (não gerado a partir do código),
    ela fica desatualizada silenciosamente sempre que uma parte muda algo
    que ela descreve; já havia um aviso nesse sentido desde a Parte 18,
    mas na prática passou despercebido por 11 partes seguidas — vale
    checar essa tela a cada parte futura que mexer numa das áreas que ela
    cobre, em vez de confiar em lembrar depois.
37. **Parte 30 — Comissão de 10% do bar por camareira, comanda
    "responsável" e numeração mensal** (21/09/2026, feita direto em
    `main`, pós parte 29):
    - **Comissão de 10% do bar por camareira** (nova, do zero):
      `getBarCommissionByCamareira`
      (`src/lib/actions/comandas.ts`) soma, por camareira, 10% do valor
      de cada comanda que ela lançou **originalmente** (`created_by` —
      coluna que já existia desde a Parte 05, nunca sobrescrita por
      edições posteriores; só `last_action_by` muda quando outra
      camareira edita) — mesmo que outra tenha editado a comanda depois,
      quem lançou é sempre quem recebe. Somada pelo **mês em que a
      comanda foi lançada** (`created_at`), não pela data em que a conta
      é paga (diferente do relatório geral de consumo em `poolbar.ts`,
      que soma por `paid_at`) — o objetivo é creditar a camareira no mês
      em que ela de fato atendeu, não em qualquer mês futuro que o
      hóspede resolver pagar. Comandas canceladas não entram.
    - Tela "Comanda" da camareira (`comandas-list.tsx`): "Última ação: X"
      virou "Responsável: X", mostrando `created_by_name` — a tela do
      admin (`comandas-list-panel.tsx`) já mostrava "Original" e "Última
      ação" lado a lado, sem mudança necessária ali.
    - Resumo Executivo ganhou uma tabela (`CamareiraBarCommissionTable`)
      com essa comissão por camareira, mês atual/anterior lado a lado, e
      o card "Comissão do mês" ganhou uma segunda linha "10% bar" com o
      total de todas as camareiras no mês corrente — a colocação exata
      dessas duas coisas na tela foi reorganizada logo depois, na Parte
      32.
    - **Numeração da comanda** ("Comanda #N"): deixou de ser por conta
      corrente do quarto (reiniciava toda vez que uma conta nova nascia,
      podendo repetir "#1" em várias suítes ao mesmo tempo) e passou a
      ser sequencial por **mês inteiro** (nova coluna `monthly_number`,
      migration `040_comanda_monthly_number.sql`), pela ordem de
      lançamento — atribuída uma única vez em `submit_comanda`, nunca
      recalculada numa edição (reflete a ordem de lançamento original,
      não o estado atual). A coluna antiga `sequence_number` (por conta)
      continua existindo, só não é mais exibida — ainda usada
      internamente por `edit_comanda` pra não colidir dentro de uma
      mesma conta. Migration faz o backfill das comandas já lançadas no
      mês corrente, na ordem de `created_at`; meses anteriores não são
      renumerados (nenhuma tela os exibe além da janela de 7 dias de
      "Comandas inativas", que nunca alcança um mês fechado).
    - **Testado**: simulação direta no banco local (comanda lançada por
      uma camareira e editada por outra — comissão continua indo pra
      quem lançou; comanda cancelada — corretamente excluída) e a query
      aninhada nova (`bar_comanda_items` → `bar_comandas` → `profiles`)
      verificada contra o `next dev` local antes de integrar.
38. **Parte 31 — Isenção da taxa de serviço de 10% por conta** (21/09/2026,
    feita direto em `main`, pós parte 30): a taxa de serviço de 10% sobre
    o bar da piscina não é uma cobrança obrigatória por lei — a camareira
    agora pode isentá-la numa conta específica.
    - Botão "Isentar taxa de serviço (10%)" ao lado do valor calculado,
      na tela "Consumo por quartos" da camareira (`consumo-quartos-panel.tsx`),
      com `confirm()` antes (afeta dinheiro e comissão da equipe). Nova
      coluna `room_bills.service_charge_waived` (migration
      `041_service_charge_waiver.sql`) + função `security definer`
      `set_room_bill_service_charge_waived`, seguindo o mesmo padrão de
      `close_room_bill`/`reopen_room_bill`/`pay_room_bill`. Permitida em
      qualquer status não pago; uma vez paga, a conta é histórico
      imutável como qualquer outro valor já congelado no projeto.
    - A isenção some com os 10% do total **daquela conta específica**
      (inclusive no recibo em PDF, que passou a mostrar "· isenta") e da
      comissão de quem lançou as comandas que a compõem — mas só das
      comandas dessa conta: nenhuma outra conta da mesma suíte (passada
      ou futura) nem nenhuma outra comanda da mesma camareira em
      qualquer outro quarto é afetada.
      `getBarCommissionByCamareira`/nova `getBarCommissionByCamareiraForPeriod`
      (pro Histórico) passaram a excluir comandas de contas isentas. As
      telas do admin (Consumo por Quartos, detalhe de tarefa em
      `checklist-detail.tsx`) mostram "· isenta" quando aplicável, sempre
      só leitura.
    - **Testado**: a query aninhada nova (comanda → conta → isenta)
      verificada contra o `next dev` local; simulação direta no banco
      confirmando que isentar uma conta zera a comissão só das comandas
      dela (uma segunda comanda da mesma camareira, em outra conta,
      permaneceu intacta).
39. **Parte 32 — Resumo Executivo reestruturado em 5 cards de consulta
    rápida + menu de seções** (21/09/2026, feita direto em `main`, pós
    parte 31; inclui o ajuste de alinhamento feito no mesmo dia como
    correção da própria leva):
    - **O Resumo Executivo virou um hub**: no topo, só os 5 cards de
      "Consulta rápida do mês corrente" (Suítes concluídas hoje, Suítes
      no café hoje, Comissão do mês, 10% bar total — separado num card
      próprio, antes cortava o valor por dividir espaço com "Comissão do
      mês" — e Ocorrências Manutenção hoje); abaixo, um menu (mesmo
      padrão de `/checklists`) que leva a telas novas, cada uma com
      `<BackLink>`: "Serviços nas suítes" (`/dashboard/servicos-suites`
      — cards de hoje/amanhã + serviços dos últimos 7 dias), "Consumo de
      frigobar" (`/dashboard/consumo-frigobar`), "Consumo de bar"
      (`/dashboard/consumo-bar`) e "Comissão de 10% do bar por
      camareira" (`/dashboard/comissao-bar`) — mais uma quinta tela,
      "Suítes vagas e limpas, disponíveis para alugar", adicionada logo
      em seguida na Parte 33.
    - **StatCard redesenhado** (`src/app/(admin)/dashboard/page.tsx`):
      ícone + título em negrito ("realçado") na mesma linha, valor
      abaixo numa fonte menor que o título mas em cor de destaque — bordô
      da marca no tema claro (`text-primary`), dourado nos dois temas
      escuros (`dark:text-[#E8B85C]`, já que a cor "primary" desses dois
      temas é quase branca, igual ao resto do texto, e não serviria de
      destaque sozinha). Correção de alinhamento no mesmo dia: o título
      mais comprido dos cinco ("Ocorrências Manutenção hoje") estourava a
      borda do card por faltar `min-w-0` no item flex (sem isso um item
      flex não encolhe abaixo do tamanho do próprio conteúdo), e usava
      `items-center` na linha ícone+título, que alinha o ícone ao centro
      do bloco de texto inteiro — como esse título quebra em mais linhas
      que os outros, o ícone descia mais que o dos demais cards,
      desalinhando os círculos entre si. Corrigido com `min-w-0 flex-1`
      no título e `items-start` no lugar de `items-center` (ícone sempre
      no topo, alinhado com os das outras cards independente de quantas
      linhas o título ocupar); valor também centralizado horizontalmente.
    - Removido o gráfico de barras "Totais do mês · N suítes · R$ X de
      comissão" (redundante com os cards) — `monthly-chart.tsx` excluído,
      sem mais nenhum uso.
    - `getPoolbarMonthlySummary` (`src/lib/actions/poolbar.ts`) passou a
      devolver petiscos e bebidas separados (`PoolbarSplitSummary`), só
      pro Resumo Executivo — `getPoolbarConsumptionForPeriod`, usada pelo
      Histórico, não foi pedida pra mudar e continua com o total único de
      sempre.
    - Histórico > "Por camareira" dividido em dois cards: "— serviços"
      (Arrumação/Saída com Chegada/Somente Saída/Somente Chegada/Troca/
      Total/Duração média) e "— ocorrências e comissão de bar"
      (Ocorrências Manutenção/Ocorrências resolvidas/Total 10% bar no
      período) — mesmo CSV de sempre, com todas as colunas juntas.
    - **Lição de teste nova**: verificado com uma sessão autenticada de
      verdade, não só o bypass de middleware usado até então (que só
      funciona pra rotas de API — uma página real dentro do route group
      `(admin)` tem sua própria checagem de sessão em `layout.tsx`, via
      `getCurrentProfile()`, independente do middleware, então bypassar
      só o middleware não é suficiente pra testar uma página de verdade
      sem login). A técnica: login via password grant direto contra o
      GoTrue local (`POST /auth/v1/token?grant_type=password`) pra pegar
      um `access_token`/`refresh_token` reais, monta-se o cookie que o
      `@supabase/ssr` espera (`sb-127-auth-token` no Supabase local,
      nome derivado do hostname da URL; valor = `"base64-" +
      base64url(JSON.stringify(sessão))`) e usa-se esse cookie no `curl`.
      Vale como técnica de teste padrão pra páginas admin daqui pra
      frente, mais forte que testar só via rota de API.
40. **Parte 33 — Nova tela "Suítes vagas e limpas, disponíveis para
    alugar"** (21/09/2026, feita direto em `main`, pós parte 32):
    `src/app/(admin)/dashboard/suites-disponiveis/page.tsx`, quinto item
    do menu do Resumo Executivo, logo após "Serviços nas suítes" — duas
    listas, Suítes limpas e Suítes sujas, das suítes sem hóspede previsto
    pra hoje à noite.
    - **Regra de negócio, discutida e ajustada com o proprietário antes
      de implementar** (a partir de uma proposta inicial dele, corrigida
      em duas rodadas de crítica — ver histórico da conversa pro
      raciocínio completo):
      - Suíte com serviço de hoje igual a Troca, Arrumação, Saída com
        Chegada ou Somente Chegada pressupõe hóspede essa noite →
        ocupada, fora das duas listas.
      - Suíte com serviço de hoje igual a Somente Saída → disponível;
        limpa se o serviço já estiver concluído, suja caso contrário.
        Sempre calculado **ao vivo**, sem nenhuma trava de horário — a
        proposta original do proprietário cogitava congelar a
        classificação às 15h (fim do turno típico das camareiras), mas
        isso foi descartado por criar risco real de overbooking: uma
        suíte que recebesse reserva nova depois desse horário
        continuaria marcada como "disponível" até o fim do dia.
      - Suíte sem nenhum serviço previsto hoje (já vaga) → disponível;
        pra saber se está limpa, olha só a **última tarefa registrada**
        pra ela, de **qualquer tipo**, entre os dias anteriores — limpa
        apenas se essa última tarefa for especificamente uma Somente
        Saída concluída, suja em qualquer outro caso (última tarefa de
        outro tipo, Somente Saída não concluída, ou nenhuma tarefa no
        histórico). Não basta achar uma Somente Saída concluída em algum
        dia do passado: se depois dela existe uma tarefa mais recente de
        qualquer outro tipo — inclusive uma Saída com Chegada, que a
        primeira versão desta regra incluía por engano no grupo de
        "sinais válidos de limpeza" — esse serviço mais antigo não
        garante mais nada sobre o estado atual da suíte, porque ela
        certamente foi ocupada de novo depois (uma Saída com Chegada
        implica hóspede naquela noite, então nunca pode legitimamente
        ser a última tarefa de uma suíte que hoje está vaga; se aparece
        como a mais recente no banco, é sinal de uma lacuna de dados, não
        de limpeza garantida).
    - **Testado**: 11 cenários controlados no banco local (um por suíte,
      cobrindo cada combinação da regra, incluindo os dois casos mais
      delicados — suíte cuja última tarefa registrada foi uma Saída com
      Chegada concluída, e suíte cuja tarefa mais recente é uma Arrumação
      pendente por cima de uma Somente Saída concluída mais antiga) —
      validado primeiro em SQL puro, depois confirmado batendo igual na
      tela real via sessão autenticada de verdade (mesma técnica da
      Parte 32).
41. **Parte 34 — Botões de sincronização com a Stays unificados no Resumo
    Executivo** (22/09/2026, feita direto em `main`, pós parte 33): os três
    pares de botão de sincronização (Planejamento Diário, Chegadas &
    Saídas, Mesas do Café — cada tela com "Forçar sincronização"/
    "Sincronizar agora") viraram um único par, `SyncStaysAllButton`
    (`src/app/(admin)/dashboard/sync-stays-all-button.tsx`), colocado no
    Resumo Executivo entre os 5 cards de "Consulta rápida" e o menu de
    seções — sem impedimento pra unificar, já que os três botões de cada
    tipo sempre tiveram exatamente o mesmo efeito (o cron diário, que já
    existia desde a Parte 14, sempre rodou as três sincronizações juntas
    também). Nova Server Action `syncStaysAll(options?)`
    (`src/lib/actions/stays-sync.ts`), que só chama, em sequência,
    `syncStaysPlanning`/`syncStaysArrivalsDepartures`/
    `syncStaysBreakfastTables` já existentes, repassando o mesmo `force`
    pras três — nenhuma lógica de sincronização nova, só a composição.
    Removidos os `sync-stays-button.tsx` e os botões duplicados das três
    telas individuais (Planejamento, Chegadas & Saídas, Mesas do Café), que
    passaram a não ter mais nenhum controle de sincronização próprio.
    Os nomes dos botões também mudaram, a pedido do proprietário: "Forçar
    sincronização com a Stays" → "Sincronização Stays Total - sobrescreve
    alterações inseridas pelo Admin"; "Sincronizar agora (preserva
    edições)" → "Sincronização Stays Parcial - preserva alterações
    inseridas pelo Admin".
42. **Parte 35 — Comissão de serviços nas suítes e no café: nota de
    qualidade por camareira e repartição do pote do café** (22/09/2026,
    feita direto em `main`, pós parte 34; análise crítica da proposta do
    proprietário discutida antes de implementar — ver histórico da
    conversa para o raciocínio completo): o app já tinha duas comissões
    diferentes pras camareiras — a antiga "Comissão do mês"/"comissão das
    camareiras" (café da manhã, calculada por suíte elegível × valor por
    café servido, sem nenhuma repartição individual até aqui) e a
    "Comissão de 10% do bar por camareira" (Parte 30). Esta parte deu à
    primeira um nome próprio, **"Comissão de serviços nas suítes e no
    café"**, e implementou a repartição dela entre as camareiras.
    - **Nota de qualidade do serviço**: nova coluna
      `profiles.service_quality_score` (migration
      `042_commission_score_and_statements.sql`) — um valor **único e
      contínuo por camareira** (não "por mês"), inteiro de 0 a 10, padrão
      5, editável pelo admin a qualquer momento via o mesmo componente
      `QuantityStepper` já usado em frigobar/comanda (que ganhou `min`/
      `max` opcionais nesta parte, mantendo compatibilidade com quem já
      usava só `value`/`onChange`).
    - **Fórmula de repartição** (`computeWeightedSuitesCafeCommission`,
      `src/lib/commission-math.ts` — função pura, sem I/O, separada de
      `src/lib/actions/commission.ts` porque um arquivo `"use server"` só
      pode exportar Server Actions assíncronas): o peso de cada camareira
      é a **média entre dois percentuais** — percentual dela na
      quantidade total de serviços concluídos no período (troca,
      arrumação, somente saída, somente chegada, saída com chegada, todas
      as camareiras somadas) e percentual da nota dela na soma de todas
      as notas. Como os dois percentuais somam 100% cada um, a média
      também soma 100% — o total distribuído bate exatamente com o pote,
      sem sobra nem falta, e sem dividir por zero (mês sem nenhum serviço
      ainda, ou notas todas zeradas, caem pra 0% em vez de travar).
    - **Duas visões temporais, resolvendo o descompasso identificado na
      análise crítica**: a proposta original do proprietário aplicava o
      percentual **congelado do mês passado** sobre o pote do **mês
      corrente** (ainda se formando) — períodos diferentes sobre o mesmo
      cálculo. Escolhida, entre as opções apresentadas, a alternativa que
      mantém sempre os dois do mesmo período: (1) uma **estimativa do mês
      corrente**, sempre ao vivo (percentual de serviços até hoje × pote
      do mês até hoje, ambos ainda se formando, recalculados a cada
      carregamento da tela) e (2) um **fechamento do mês passado**, sob
      demanda.
    - **Fechamento sob demanda, não automático por calendário**: botão
      "Calcular comissão do mês passado" (`calculatePreviousMonthCommissionStatement`,
      `src/lib/actions/commission.ts`) — ao clicar, captura a nota de cada
      camareira **exatamente como está naquele momento** e aplica sobre o
      percentual de serviços e o pote do mês passado inteiro, ambos já
      naturalmente estáveis (dados de um mês fechado não mudam mais, ao
      contrário da nota, que é editável a qualquer momento — só ela
      precisa ser capturada). O resultado é gravado em
      `commission_statements` (uma linha por camareira por mês,
      `unique(month, camareira_id)`); clicar de novo apaga e regrava as
      linhas daquele mês (útil depois de corrigir alguma nota). A
      comissão de bar do mesmo mês **não** é gravada nessa tabela — é
      sempre recalculada ao vivo a partir de `bar_comanda_items`
      (`getBarCommissionByCamareiraForPeriod`, já existente desde a Parte
      30), por já ser igualmente estável pra um mês fechado.
    - **Demonstrativo em PDF e por e-mail**: `src/lib/commission-statement-pdf.tsx`
      (mesmo padrão `@react-pdf/renderer` do recibo de conta, Parte 06) +
      rota `/api/dashboard/commission-statement` (admin-only, mesmo padrão
      de checagem de papel da rota do recibo) geram, sob demanda, uma
      tabela por camareira com as duas comissões (Suítes e Café, Bar) e o
      total, mais uma linha de total geral — sempre a partir do último
      demonstrativo calculado do mês passado, nunca recalculado na hora
      de baixar/enviar (garante que o PDF reflita exatamente o que foi
      "fechado" no clique). `sendCommissionStatementEmail` reaproveita o
      mesmo e-mail e o mesmo remetente Resend já usados pro recibo de
      conta — mas, diferente daquele envio (que é "melhor esforço"
      silencioso), aqui é uma ação explícita do admin com resultado
      sempre mostrado por toast.
    - **"Comissão do mês" saiu de `/mesas/gerenciar` e virou parte de
      `/dashboard/comissoes`**: a tela "Comissão de 10% do bar por
      camareira" foi renomeada **"Comissões das camareiras"** (rota
      renomeada de `/dashboard/comissao-bar` pra `/dashboard/comissoes`)
      e passou a ter duas seções — a tabela de bar que já existia, e um
      novo card "Comissão de serviços nas suítes e no café", que também
      herdou o campo "Valor da comissão por café servido" (removido do
      admin de `/mesas/gerenciar`, que não tinha mais nenhum motivo pra
      carregar `commission_settings`). Extraído `getBreakfastCommissionPotForRange`
      (`src/lib/actions/breakfast-commission.ts`) do cálculo que já
      existia duplicado no Resumo Executivo — mesma regra de sempre
      (suítes elegíveis × valor por café servido, com fallback e
      congelamento por mês já estabelecidos desde a Parte 27), agora numa
      função só, reaproveitada pelo Resumo Executivo e pela nova tela.
    - **Cards do Resumo Executivo renomeados**: "Comissão do mês" →
      "Comissão Suítes e Café"; "10% bar total" → "Comissão Bar" — mesmos
      valores de sempre, só o rótulo mudou.
    - **E-mail de envio virou tela própria**: o card "E-mail da
      contabilidade" (Parte 06) saiu da aba "Consumo por suítes" de
      `/frigobar` e virou a tela **"Cadastrar e-mail de envio"**
      (`/dashboard/email-envio`), último item do menu do Resumo Executivo
      — card renomeado **"E-mail de envio"**, já que agora serve dois
      propósitos (recibo de conta paga e demonstrativo de comissões). Os
      nomes internos (`receipt_settings`, `accounting_email`,
      `getReceiptSettings`/`updateAccountingEmail`) não mudaram, só o
      texto visível e a tela em que aparece — mesma convenção já registrada
      na Parte 12 pra "Quarto" → "Suíte".
    - **Histórico**: coluna "Comissão (R$)" do card "Resumo diário"
      renomeada "Comissão Suítes e Café" (tabela e CSV); no card "Por
      camareira — ocorrências e comissão de bar", coluna "Total 10% bar no
      período" renomeada "Comissão Bar" e nova coluna "Comissão Suítes e
      Café" acrescentada ao final — essa última **sempre ao vivo**, pra
      qualquer período arbitrário escolhido no filtro do Histórico (não o
      retrato pontual gravado pelo botão "Calcular", que é específico de
      "o mês inteiro anterior a hoje"), via `getSuitesCafeCommissionForPeriod`.
    - **Limitação aceita conscientemente**: o percentual de serviços e o
      pote usados na estimativa do mês corrente e no cálculo do mês
      passado consideram só as camareiras **atualmente ativas** — uma
      camareira desligada no meio do período não aparece nem tem seus
      serviços contados (diferente da comissão de bar, que deriva as
      camareiras diretamente das comandas já lançadas, sem depender de
      quem está ativa hoje). Não corrigido por não ter sido pedido e por
      exigir mesclar duas fontes diferentes (roster atual + histórico de
      tarefas) só pra um caso raro (saída de uma camareira no meio do
      mês).
    - **Testado**: fluxo completo via sessão autenticada real (mesma
      técnica da Parte 32) contra o `next dev` local — nota incrementada
      de 5 para 6 via stepper, botão "Calcular comissão do mês passado"
      gravando corretamente em `commission_statements` (conferido também
      direto no Postgres local), PDF baixado com `Content-Type:
      application/pdf`, e todas as telas/rótulos renomeados confirmados
      presentes (Resumo Executivo, Comissões das camareiras, E-mail de
      envio, Histórico) e ausentes nos lugares antigos (Mesas do Café,
      Consumo de Bar e Frigobar).
43. **Parte 36 — Exclusão da conta "admin-camareira" e fechamento no dia
    25 em vez do fim do mês** (22/09/2026, feita direto em `main`, pós
    parte 35; duas correções pedidas pelo proprietário depois de ver a
    Parte 35 em produção):
    - **"admin-camareira" excluída de comissões e demonstrativos**: essa
      conta (mencionada desde a Parte 08, seção 15, como "de origem
      duvidosa") é usada pelo próprio admin só pra teste/ajuste, nunca uma
      camareira de verdade — passou a ser ignorada em todo cálculo de
      comissão e em todo relatório/demonstrativo que lista camareiras.
      Nova constante `EXCLUDED_CAMAREIRA_NAME` (`src/lib/commission-math.ts`,
      valor `"admin-camareira"`, comparado pelo nome — não existe nenhum
      outro sinal no banco pra distinguir essa conta de uma camareira
      real, já que o papel dela é `camareira`), usada em duas pontas: um
      `.neq("name", ...)` na busca de camareiras ativas
      (`getActiveCamareiras`, `src/lib/actions/commission.ts` —
      afeta a estimativa do mês corrente, o fechamento do período e a
      coluna do Histórico) e um filtro equivalente dentro de
      `summarizeBarCommissionRows` (`src/lib/actions/comandas.ts`, afeta
      `getBarCommissionByCamareira`/`getBarCommissionByCamareiraForPeriod`,
      logo os cards de comissão de bar do Resumo Executivo, "Comissões das
      camareiras" e Histórico). Escopo deliberadamente restrito a
      comissões — a conta continua aparecendo normalmente em telas sem
      relação com dinheiro (Planejamento Diário, "Por camareira —
      serviços" do Histórico etc.), que não foram tocadas por não terem
      sido pedidas.
    - **Fechamento do período de comissão de serviços nas suítes e no
      café passou do fim do mês calendário pro dia 25**: a comissão do mês
      precisa estar pronta e paga **antes** do mês terminar, não só depois
      — fechar junto com o calendário não deixava tempo hábil. Novo
      conceito **"último período fechado"**, sempre com ~1 mês de duração
      mas alinhado ao dia 25 em vez do dia 1: o período que fecha no dia
      25 de um mês vai do dia 26 do mês anterior até esse dia 25. O dia 25
      em si ainda conta como parte do período **em formação** (só fecha a
      partir do dia 26) — ou seja, entre os dias 26 de um mês e 25 do mês
      seguinte, "o último período fechado" é sempre o mesmo, até o
      seguinte (fechado no próximo dia 25) tomar o lugar dele. Implementado
      em `closedPeriodRange` (`src/lib/commission-math.ts`, função pura,
      testada isolada contra 11 datas de borda antes de integrar —
      inclusive troca de ano, ex.: 1º/25/26 de janeiro calculando
      corretamente dezembro do ano anterior como período fechado). O botão
      "Calcular comissão do mês passado" virou **"Calcular comissão do
      último período"** (`calculateClosedPeriodCommissionStatement`, ex-
      `calculatePreviousMonthCommissionStatement`) e
      `getPreviousMonthDemonstrativo` virou `getClosedPeriodDemonstrativo`.
      A coluna `commission_statements.month` (que guardava o dia 1 do mês
      calendário) foi renomeada `period_end` (guarda a data do dia 25 de
      fechamento) via migration `043_commission_period_cutoff_day25.sql`,
      que também apaga as linhas já calculadas sob a regra antiga (mês
      calendário) — não correspondem a nenhum período da regra nova, e o
      valor em R$ que carregavam era todo zero (dado de teste); a nota de
      cada camareira (`profiles.service_quality_score`, já ajustada de
      verdade em produção antes desta parte) não foi afetada, só o
      cálculo em R$ precisa ser refeito.
    - **Terminologia "mês passado" → "último período (mês)"**: em todo
      lugar que mostrava "mês passado" pra esse fechamento — botão,
      subtítulo do card, mensagem de "ainda não calculado", título do PDF,
      assunto/corpo do e-mail — passou a mostrar "Último período" seguido,
      entre parênteses, do nome do mês em que cai o dia 25 de fechamento
      (ex.: período de 26/07 a 25/08 vira "Último período (Agosto de
      2026)"). A estimativa do mês corrente (ao vivo, informativa)
      continua com sua própria rotulagem por mês calendário — não foi
      pedido pra mudar, e não é o "último período fechado".
    - **Testado**: `closedPeriodRange` verificada isolada contra 11 casos
      sintéticos antes de integrar; fluxo completo (clicar "Calcular
      comissão do último período", conferir "Último período (Agosto de
      2026)" na tela, baixar o PDF) testado via sessão autenticada real
      contra o `next dev` local, com o valor gravado em
      `commission_statements.period_end` conferido direto no Postgres
      (`2026-08-25` pra hoje 22/09/2026, batendo com o esperado — antes do
      dia 25 de setembro, o último período fechado ainda é o de agosto).
      Migration aplicada em produção depois do teste local.
44. **Parte 37 — Camareira desligada não some do histórico de comissão, e
    corte no dia 25 estendido pra comissão de bar** (22/09/2026, feita
    direto em `main`, pós parte 36; duas correções pedidas pelo
    proprietário sobre a Parte 36):
    - **Camareira que deixou de ser usuária do sistema continua
      aparecendo nas tabelas/demonstrativos/relatórios de comissão
      referentes a quando ela trabalhou** — antes, `getActiveCamareiras`
      (usada pela estimativa do mês corrente, pelo fechamento do último
      período e pela coluna do Histórico da comissão de serviços nas
      suítes e no café) só olhava camareiras com `active = true`, então
      desativar alguém a fazia sumir retroativamente de qualquer período
      em que ela realmente trabalhou — essa lacuna já tinha sido
      documentada como "limitação aceita conscientemente" na Parte 35, e
      o proprietário pediu pra corrigir. Renomeada pra
      `getCamareiraRoster(supabase, from, to)`: agora soma as camareiras
      ativas de hoje com qualquer camareira que tenha pelo menos um
      serviço concluído no intervalo pedido, mesmo já desativada
      (buscando o nome/nota dela via o join de `daily_room_tasks` com
      `profiles`, já que a query original só olhava a tabela `profiles`
      diretamente). "admin-camareira" continua sendo a única exceção
      (nunca entra, ativa ou não). A comissão de bar já não tinha esse
      problema — sempre derivou a lista de camareiras diretamente das
      comandas lançadas (`created_by`), nunca de um filtro por `active`.
    - **O corte no dia 25 e o termo "último período" passaram a valer
      também pra comissão de 10% do bar por camareira**, no card
      "Comissão de 10% do bar por camareira" dentro de "Comissões das
      camareiras" — antes mostrava "Mês atual"/"Mês anterior" (mês
      calendário, sempre ao vivo). Diferente da comissão de suítes e
      café, a comissão de bar não depende de nenhuma nota editável que
      precise ser capturada num instante — o valor de um período já
      fechado nunca muda sozinho, então **não precisou de um botão
      "Calcular" nem de uma tabela de retrato congelado**: nova função
      `getBarCommissionScreenSummary` (`src/lib/actions/comandas.ts`)
      simplesmente chama `getBarCommissionByCamareiraForPeriod` (já
      existente) duas vezes — uma pro mês corrente até hoje ("estimativa",
      mesmo texto/conceito já usado no card de suítes e café), outra pro
      intervalo do último período fechado (`closedPeriodRange`, a mesma
      função pura da Parte 36) — sempre recalculada ao vivo a cada
      carregamento da tela. `getBarCommissionByCamareira` (mês atual/mês
      anterior calendário) **não foi tocada**, continua servindo só o
      card "Comissão Bar" do Resumo Executivo, que não foi pedido pra
      mudar. `CamareiraBarCommissionTable` foi ajustada pras novas colunas
      ("Mês corrente (estimativa)" / "Último período (Mês)") com um
      parágrafo explicativo acima da tabela.
    - **Helper de rótulo de mês centralizado**: `monthLabelPt`, que vivia
      duplicada em `commission-statement-pdf.tsx` e
      `suites-cafe-commission-panel.tsx`, virou `monthYearLabelPt` em
      `src/lib/date.ts` (usada também pelo novo texto do card de bar) —
      elimina a duplicação e garante que "Último período (Mês de Ano)"
      seja formatado exatamente igual em toda parte (tela, PDF, e-mail).
    - **Testado**: cenário criado direto no Postgres local — uma
      camareira com `active = false` e duas tarefas concluídas (uma em
      agosto, dentro do último período fechado; outra em setembro, dentro
      do mês corrente) — confirmado que ela aparece na estimativa do mês
      corrente, no demonstrativo do último período fechado (depois de
      clicar "Calcular") e no Histórico filtrado por agosto, via sessão
      autenticada real contra o `next dev` local. O card de bar
      confirmado mostrando as duas colunas novas com os rótulos e o texto
      explicativo corretos. Fixture de teste removida do banco local
      depois.

## Convenções e decisões importantes

- **Modelo de planejamento**: o trabalho de um dia é planejado com um dia de
  antecedência (admin clica em "Amanhã" pra planejar); a aba "Hoje" existe
  para ajustes de última hora e testes. Camareiras sempre veem/atuam em
  "Hoje". **Desde a Parte 21**, a aba padrão ao abrir/retornar pra
  qualquer uma das telas com Hoje/Amanhã (Planejamento Diário, Chegadas &
  Saídas, Mesas do Café) é sempre "Hoje" — nunca fica "lembrando" a última
  aba escolhida.
- **Ambiente local de teste (desde a Parte 08, seção 15)**: `npm run dev`
  na máquina do proprietário roda contra um Supabase **local via Docker**
  (`npx supabase start`), não contra o banco de produção — testar não polui
  mais dados/estatísticas reais. Passo a passo completo em `README.md`
  seção 4. Login admin local: `admin@camareiras.vilacorada.app` /
  `admin123`. As credenciais da nuvem ficam em `.env.local.cloud` (não
  versionado) só para o caso raro de precisar rodar local contra produção.
- **Testar uma página admin de verdade precisa de sessão real, não só
  bypass de middleware (desde a Parte 32)**: o truque já usado neste
  projeto de adicionar temporariamente uma rota a `isPublic` em
  `src/lib/supabase/middleware.ts` só funciona pra rotas de API — uma
  página dentro do route group `(admin)` (ou `(camareira)`) tem sua
  própria checagem de sessão em `layout.tsx`, via `getCurrentProfile()`
  (`src/lib/actions/session.ts`), que roda independente do middleware e
  redireciona pra `/login` mesmo com o bypass. Pra testar uma página real
  contra o `next dev` local sem precisar de navegador: login via password
  grant direto contra o GoTrue local (`curl -X POST
  http://127.0.0.1:54321/auth/v1/token?grant_type=password` com
  `apikey`/e-mail/senha do admin local), montar o cookie que o
  `@supabase/ssr` espera (nome `sb-127-auth-token` — derivado do
  hostname `127.0.0.1` da URL local; valor = `"base64-" +
  base64url(JSON.stringify(sessão))`, a sessão sendo o JSON cru devolvido
  pelo GoTrue) e passar esse cookie no `curl`. Mais forte que o bypass de
  middleware porque exercita a autenticação de verdade, ponta a ponta.
- **Migrações do banco**: todo schema novo é adicionado em
  `supabase/schema.sql` (para instalações novas) **e** em um arquivo
  numerado sequencialmente em `supabase/migrations/00N_*.sql` (para rodar no
  projeto Supabase já existente, manualmente, no SQL Editor). Ao adicionar
  um novo valor a um `enum` do Postgres, isso precisa ser feito em duas
  execuções separadas (o Postgres não permite usar um valor de enum recém
  criado na mesma transação em que foi criado) — ver
  `supabase/migrations/003_troca_task_type.sql` como exemplo.
- **Segurança**: `SUPABASE_SERVICE_ROLE_KEY` só é lida em
  `src/lib/supabase/admin.ts`, importado exclusivamente por Server Actions
  (`"use server"`); nunca é usada em componentes `"use client"`. Variáveis
  `NEXT_PUBLIC_*` são as únicas expostas ao navegador. RLS ativa em **todas**
  as tabelas (checado manualmente: contagem de `create table` bate com
  contagem de `alter table ... enable row level security` em
  `supabase/schema.sql`) — admin tem acesso total, cada papel só ao que é
  seu/disponível.
- **Vulnerabilidade crítica do Next.js corrigida** (não introduzida por
  nenhuma parte deste projeto — só detectada ao instalar
  `@react-pdf/renderer`/`resend` na Parte 06, via `npm audit`): execução
  remota de código não autenticada, presente até a 16.3.2. Atualizado para
  `next@16.3.5` / `eslint-config-next@16.3.5` (pin exato, sem `^`, mesmo
  padrão já usado para `react`/`react-dom`) logo em seguida, mais
  `npm audit fix` para as demais vulnerabilidades restantes (todas em
  dependências transitivas de ferramentas de desenvolvimento — CLI do
  shadcn e ESLint —, nunca no bundle do app). `npm audit` limpo
  (0 vulnerabilidades) depois disso.
- **Transições de estado sensíveis via função `security definer`, não via
  policy de UPDATE combinada**: sempre que uma linha precisa passar por mais
  de um estado (ex.: pendente → selecionada → resolvida/concluída) e mais de
  um papel/usuário participa da transição, implementar como função SQL
  `security definer` com checagem explícita de papel no início (padrão de
  `is_admin()`/`is_manutencao()`, `select_occurrence`/`resolve_occurrence`,
  `claim_maintenance_category`/`complete_maintenance_*`), nunca como uma
  policy de UPDATE só cujo `with check` tente cobrir várias transições ao
  mesmo tempo — isso já causou um bug real em produção (ver PRD parte02,
  seção 4.1) porque o Postgres nem sempre valida esse tipo de `with check`
  combinado do jeito esperado, e o erro só aparece em teste real, não em
  `npm run build`/`lint`.
- **Sempre checar `.error` de `supabase.rpc(...)` em Server Actions**: um
  `await supabase.rpc(...)` sem checar `{ error }` engole silenciosamente
  qualquer falha (função inexistente porque a migration não rodou,
  permissão negada etc.) e a action continua retornando `{ success: true }`
  — a UI mostra "salvo com sucesso" mesmo sem nada ter mudado no banco. Já
  aconteceu de verdade (reordenação de itens em Parte 03, seção 10) e só
  apareceu em teste manual, não em `npm run build`/`lint`. Sempre capturar
  o `error` do retorno de `.rpc()` e devolver `{ error: error.message }`
  quando existir, igual já é feito para `.insert()`/`.update()`. **A mesma
  regra vale pra `.upsert()`/`.insert()`/`.update()` direto, não só
  `.rpc()`**: o bug de sincronização de mesas da Parte 28 foi exatamente
  isso — um `.upsert()` continuou gravando uma coluna que uma migration
  tinha removido, o erro nunca era checado, e a alocação de suítes falhava
  silenciosamente em produção. Vale auditar **todos** os pontos de escrita
  de uma função sempre que uma coluna que ela grava for removida/renomeada
  por uma migration nova, não só assumir que a prática geral de checar
  `.error` já cobre o caso.
- **Mudança de regra de cálculo nunca deve zerar retroativamente um valor
  já calculado** (pedido explícito do proprietário, Parte 27): quando uma
  regra muda e passa a depender de um dado que datas passadas não têm
  (porque foram calculadas antes da regra nova existir), a mudança só deve
  valer a partir da data em que esse dado passa a existir de verdade — não
  faz sentido mostrar zero num valor que já tinha sido calculado
  corretamente antes, só porque falta informação pra aplicar a regra nova
  retroativamente. Na prática, isso significa usar uma coluna **anulável**
  (não um valor padrão como `0` ou `false`) pra guardar o resultado da
  regra nova, e cair de volta pra regra antiga sempre que essa coluna for
  `null` pra uma data — `null` e "zero de verdade" precisam ser
  distinguíveis. Caso de origem: `daily_breakfast_settings.eligible_suites_count`
  (migration `039_eligible_suites_nullable_fallback.sql`) — ver Parte 27.
- **Fonte de títulos**: "The Seasons" (paga, foundry My Creative Land) não
  foi licenciada ainda — o app usa Playfair Display (Google Fonts) como
  substituta. Trocar em `src/app/layout.tsx` quando os arquivos forem
  adquiridos.
- **Primeiro usuário admin**: não é criado pelo app (a tela "Usuários" só
  cria camareiras e funcionários de manutenção) — precisa ser criado
  manualmente uma única vez via painel do Supabase. Passo a passo no
  `README.md`.
- **Recibo por e-mail** (Parte 06, ver `src/lib/actions/room-bills.ts`):
  `RESEND_API_KEY` é obrigatória por variável de ambiente — sem ela o
  envio automático falha silenciosamente (é "melhor esforço" por design) e
  fica marcado como não enviado. O e-mail de destino (contabilidade) **não**
  é variável de ambiente — é configurável pelo admin na própria tela
  "Consumo por quartos" (tabela `receipt_settings`, singleton). Domínio de
  envio verificado no Resend: `consumos.vilacorada.com.br` (subdomínio
  dedicado, separado do domínio principal do site, seguindo a prática
  recomendada de isolar a reputação de envio de e-mail transacional);
  remetente padrão `recibos@consumos.vilacorada.com.br`, sobrescrevível por
  `RECEIPT_FROM_EMAIL` se precisar trocar.

## Parte 02 do projeto: módulo de Manutenção (implementada e mesclada em `main`)

> Requisitos completos (texto integral do proprietário) + changelog
> detalhado de decisões/desvios em `PRD_Camareiras_parte02.md` (seção 4) —
> ler antes de mexer em qualquer parte deste módulo, pois tem detalhes finos
> (ex.: os dois checklists por trabalho de manutenção preventiva) que não
> cabem neste resumo.

**Objetivo**: controle de manutenção corretiva (ocorrências imediatas
identificadas pelas camareiras) e preventiva (agenda recorrente por
categoria/item), com um novo papel de usuário "Funcionário de Manutenção".

**Status**: implementação completa, testada em localhost pelo proprietário
com sucesso (fluxo de ocorrências corretivas e de manutenção preventiva,
ambos ponta a ponta), **mesclada em `main` via PR #1 e implantada em
produção**. O banco de dados já estava pronto antes do merge (as migrations
foram rodadas contra o mesmo projeto Supabase único usado por local e
produção — ver nota abaixo).

### O que foi construído (mapa rápido de arquivos)

- **Papel novo**: enum `user_role` ganhou `manutencao`; rotas do
  funcionário de manutenção ficam em `src/app/manutencao/` — **pasta real,
  não route-group** (um route-group `(manutencao)` foi tentado primeiro e
  colidiu com `/ocorrencias` do admin porque parênteses não viram segmento
  de URL; lição: ao criar um papel novo com prefixo de URL próprio, usar
  pasta real, não `(grupo)`). Layout em `src/app/manutencao/layout.tsx`.
- **Tela "Camareiras" → "Usuários"**: `src/app/(admin)/usuarios/` (antes
  `camareiras/`); Server Actions em `src/lib/actions/users.ts` (antes
  `camareiras.ts`) — `createUser`/`updateUser`/`resetUserPassword`/
  `deleteUser`, todas aceitam `role: "camareira" | "manutencao"`.
- **Ocorrências de manutenção com ciclo de vida** (pendente → selecionada →
  resolvida): `src/lib/actions/occurrences.ts`
  (`getManutencaoOccurrences`/`selectOccurrence`/`resolveOccurrence`), tela
  `src/app/manutencao/ocorrencias/`; admin vê status/horários em
  `/ocorrencias`, coluna "Resolvidas" em `/ocorrencias/historico` e
  "Ocorrências resolvidas" em `/historico` geral.
- **Manutenção Preventiva**: tabelas `maintenance_categories`/
  `maintenance_items`/`maintenance_completions`; Server Actions em
  `src/lib/actions/maintenance.ts`; labels/periodicidade em
  `src/lib/maintenance.ts`. Cada item guarda seu ciclo atual
  (`next_due_date`/`status`/`selected_by`) e, ao ser concluído, grava uma
  linha em `maintenance_completions` (histórico) e agenda a próxima data —
  não existe tabela de agendamentos pré-gerados. CRUD do admin: aba
  "Manutenção Preventiva" em `src/app/(admin)/checklists/
  maintenance-preventiva-panel.tsx`. Tela do funcionário
  (`src/app/manutencao/preventiva/`): cards por **categoria + semana**
  (semana corrente no topo, semanas atrasadas ainda não resolvidas abaixo),
  link para checklist em `[categoryId]/[weekStart]/` com as duas seções
  (não técnico marcável / técnico externo com nome + conclusão), e tabela
  somente-leitura "Próximas quatro semanas". Dashboard do admin
  (`src/app/(admin)/manutencao-preventiva/`): tabela única "Pendentes,
  selecionadas e concluídas, esta semana" + "Planejamento semanal"
  (filtrável, com link por semana para `semana/[weekStart]/`).
  Componentes compartilhados: `src/components/shared/week-maintenance-table.tsx`
  e `src/components/shared/weekly-planning-table.tsx`.
- Item de menu do admin "Checklists & ocorrências manutenção" renomeado
  para **"Listas"**.
- **As migrations já estão aplicadas no banco** — `008_funcionario_manutencao.sql`,
  `009_fix_manutencao_occurrence_rpc.sql`, `010_manutencao_preventiva.sql`
  e `011_manutencao_preventiva_por_semana.sql`, além de
  `012_toggle_check_rpc.sql`, `013_reorder_items.sql` e
  `014_maintenance_start_dates.sql` da Parte 03 (seção 10) — todas rodadas
  manualmente no SQL Editor. **Nota (atualizada na Parte 08, seção 15)**:
  isso valia porque, até 15/09/2026, este projeto usava **um único
  projeto Supabase** para local e produção (mesma `NEXT_PUBLIC_SUPABASE_URL`/
  chaves em Development, Preview e Production na Vercel). Migrations
  rodadas manualmente no SQL Editor da nuvem continuam sendo o processo
  para **produção** (Development/Preview/Production na Vercel continuam
  compartilhando o projeto Supabase da nuvem entre si — isso não mudou).
  O que mudou foi só o **dev local fora da Vercel** (`npm run dev` na
  máquina do proprietário): passou a rodar contra um Supabase isolado via
  Docker (ver Parte 08 e `README.md` seção 4), não mais contra o banco de
  produção — então uma migration nova agora precisa ser aplicada nos dois
  lugares: no SQL Editor da nuvem (produção) e manualmente no Postgres
  local (`docker exec ... psql ... -f - < supabase/migrations/0NN_*.sql`),
  se quiser testá-la localmente antes.

### Lição de arquitetura (a mais importante desta parte)

Um bug real apareceu em teste (não em `npm run build`/`lint`): uma policy
de RLS de UPDATE cobrindo duas transições de estado ao mesmo tempo
(selecionar + resolver) falhava no `with check` do Postgres ao tentar
resolver uma ocorrência já selecionada. A correção — e o padrão adotado daí
em diante para toda transição de estado sensível — foi usar funções SQL
`security definer` com checagem explícita de papel (`select_occurrence`/
`resolve_occurrence` para ocorrências;
`claim_maintenance_category`/`complete_maintenance_nao_tecnico`/
`complete_maintenance_tecnico` para manutenção preventiva), o mesmo padrão
já usado por `is_admin()`/`is_manutencao()`. Ver detalhe completo em
`PRD_Camareiras_parte02.md` seção 4.1, e a regra geral já incorporada em
"Convenções e decisões importantes" acima — **vale para qualquer parte
futura do projeto, não só esta**.

### Regras específicas desta parte 02 (histórico — válidas durante o desenvolvimento pré-merge)

- Não mudar nada fora do escopo de manutenção sem pedir autorização antes
  ao proprietário (instrução explícita dele em `PRD_Camareiras_parte02.md`
  seção 2.3) — restrição que valeu até o merge/deploy (já concluídos); não
  se aplica mais às iterações normais pós-merge (ex.: Parte 03, seção 10).
- Identidade visual mantida igual à parte 1 — nenhuma paleta, tema ou
  componente visual novo foi introduzido.

## Skills e agents instalados a usar neste projeto

Instalados globalmente em `~/.claude/skills` e `~/.claude/agents` (via
`claude-code-templates`), disponíveis em qualquer sessão. Neste projeto,
aplicar proativamente:

- **Skill `supabase-postgres-best-practices`**: consultar ao criar/alterar
  tabelas, índices, políticas de RLS ou queries em `supabase/schema.sql`,
  `supabase/migrations/*.sql` e nas Server Actions de `src/lib/actions/`.
- **Skill `security-audit`**: rodar antes de qualquer deploy/push relevante,
  além da checagem manual já feita (chave `SUPABASE_SERVICE_ROLE_KEY`
  isolada, RLS ativa etc.).
- **Skill `frontend-design`**: consultar ao criar/redesenhar telas ou
  componentes visuais em `src/app/` e `src/components/`.
- **Agent `code-reviewer`**: acionar para revisão de mudanças antes de
  commit/push em funcionalidades sensíveis (Server Actions, RLS, auth).
- **Agent `code-explorer`**: acionar para mapear como uma funcionalidade
  existente funciona antes de alterá-la, em vez de vasculhar o código
  manualmente.

As skills `stripe-integration` e `micro-saas-launcher` também foram
instaladas globalmente mas não se aplicam ao escopo atual deste projeto
(não há pagamentos nem modelo de negócio SaaS aqui); ficam disponíveis caso
o escopo mude no futuro.

## Onde encontrar cada coisa

- `PRD_Camareiras_parte01.md` — requisitos completos + changelog detalhado
  da parte 1 (já implementada).
- `PRD_Camareiras_parte02.md` — requisitos completos do módulo de
  Manutenção (parte 2, implementada e testada, ver seção acima) +
  changelog de decisões/desvios (seção 4).
- `PRD_regrasdenegocio.md` — regras de negócio da integração com a API da
  Stays (**implementada e em produção desde a Parte 11, com extensões até
  a Parte 28**): regra de preferência admin-vs-sincronização (inclusive as
  lápides de exclusão e a sincronização forçada/não-forçada sob demanda),
  regras de Arrumação/Troca por duração da reserva, Saída com Chegada/
  Somente Saída/Somente Chegada, Chegadas & Saídas, a regra de
  preenchimento das mesas do café por proximidade da vista do mar
  (refinada na Parte 24: só a Mesa 7 aceita mais de uma suíte) e a busca
  de reservas a partir de ontem pra não perder saídas de hoje (Parte 23).
  Ler antes de mexer em qualquer parte dessa integração — cada seção tem
  notas de implementação datadas marcando o que já mudou desde a versão
  original do documento.
- `README.md` — setup local (Docker/Supabase local desde a Parte 08, seção
  15), deploy na Vercel, variáveis de ambiente.
- `supabase/schema.sql` / `supabase/seed.sql` — schema e dados iniciais.
- `supabase/migrations/` — alterações incrementais do banco, em ordem
  (aplicadas manualmente na nuvem; começam em `002`, não existe `001`).
- `supabase/config.toml` — config do Supabase CLI para o banco local
  (Parte 08); `[db.migrations]`/`[db.seed]` ficam desabilitados de
  propósito, ver nota na Parte 08 (seção 15).
- `src/app/(admin)/` — telas do proprietário/admin.
- `src/app/(admin)/checklists/` — submenu "Listas" (ver Parte 03, seção 10):
  `page.tsx` é o menu vertical; `[type]/` (arrumação/troca/preparação),
  `ocorrencias/`, `manutencao-preventiva/`, `quartos/`, `frigobar/`,
  `poolbar/` e `mesas/` (só a aba "Layout & mesas") são as subtelas, cada
  uma com `<BackLink>`.
- `src/app/(admin)/mesas/gerenciar/` — tela "Mesas do café" do menu
  principal: alocação de suítes por mesa via diálogo
  (`table-assignment-dialog.tsx`, aberto ao clicar numa mesa do layout —
  Parte 26; substitui o antigo `TableRoomAssignments` da Parte 12),
  observação do dia, e "Total de mesas" + os 4 campos de contagem por
  tamanho de mesa — todos somente leitura, sempre calculados na hora a
  partir da alocação suíte↔mesa (Partes 16/17). Não há mais campo de
  hóspedes por mesa digitado pelo admin (Parte 27: hóspedes por suíte
  sempre vêm da Stays) nem cards por mesa (a observação de cada mesa
  individual também está dentro do diálogo agora). O campo "Valor da
  comissão por café servido" (Parte 27) saiu daqui na Parte 35, mudou-se
  pra `/dashboard/comissoes`. **Não** inclui o layout arrastável (mover
  mesa de posição), que é `src/app/(admin)/checklists/mesas/`.
- `src/components/shared/table-layout-canvas.tsx` — desenha o layout de
  mesas (formato, posição); único componente usado tanto pelo editor do
  admin quanto pela visão da camareira, e também pela visão só-leitura de
  `mesas/gerenciar`. Desde a Parte 12 também mostra as suítes alocadas em
  cada mesa (prop `tableRooms`, única fonte de ocupação/hóspedes desde a
  Parte 28 — não há mais fallback pro campo legado `daily_breakfast.guest_count`);
  desde a Parte 20, mesa **ocupada** é a que recebe a cor de destaque do
  tema (mais escura que o fundo nos temas escuros, sólida no claro); desde
  a Parte 26, `onTableClick` (só na visão do admin) abre
  `table-assignment-dialog.tsx`, e `editedTableIds` destaca em amarelo as
  mesas com alguma suíte travada manualmente (`stays_locked`) — prop que a
  camareira nunca recebe, então não vê esse destaque.
- `src/app/(admin)/frigobar/` — tela "Consumo de Bar e Frigobar" do menu
  principal, **só leitura desde a Parte 05** (seção 12): duas abas, "Lista
  de comandas do bar" (`comandas-list-panel.tsx`) e "Consumo por quartos"
  (`frigobar-rooms-panel.tsx`, acordeão por quarto, sem ações) — desde a
  Parte 31, mostra "· isenta" junto da taxa de serviço quando a camareira
  isentou os 10% daquela conta. O card "E-mail da contabilidade" que
  vivia no final desta aba saiu daqui na Parte 35, virou a tela
  "Cadastrar e-mail de envio" em `/dashboard/email-envio`.
- `src/app/(camareira)/comanda/` — tela "Comanda" da camareira (ver Parte
  05): lista de comandas ativas (`page.tsx` + `comandas-list.tsx`) e o
  formulário de pedido, compartilhado entre criar e editar
  (`comanda-form.tsx`, usado por `novo/page.tsx` e `[id]/editar/page.tsx`).
  Desde a Parte 30, a lista mostra "Responsável: X" (quem lançou a
  comanda originalmente, `created_by` — nunca muda numa edição) em vez de
  "Última ação: X", e a numeração "Comanda #N" é o `monthly_number`
  (sequencial pra pousada inteira, reinicia todo mês), não mais o antigo
  `sequence_number` por conta.
- `src/app/(camareira)/bar-piscina/` — tela "Consumo por quartos" da
  camareira (renomeada na Parte 05; era "Consumo de Bar da Piscina" na
  Parte 04): acordeão por quarto com os totais de frigobar e bar da
  piscina (só leitura, vem das comandas) e as ações de
  fechar/reabrir/pagar conta, que passaram do admin para a camareira nesta
  mesma parte. Lançamento de frigobar (`consumo-quartos-panel.tsx`)
  sempre aditivo desde a Parte 25: conta aberta soma se a camareira ligar
  "Lançar consumo adicional"; conta reaberta soma por padrão, com "zerar e
  lançar tudo novamente" como opção explícita — nenhuma das duas escolhas
  persiste entre ciclos fechar/reabrir. Desde a Parte 31, o mesmo
  componente tem o botão "Isentar taxa de serviço (10%)" ao lado do valor
  calculado — a taxa não é obrigatória por lei; isentar tira os 10% do
  total daquela conta e da comissão de quem lançou as comandas dela (só
  dessa conta, nenhuma outra é afetada).
- `src/app/(camareira)/` — telas da camareira.
- `src/app/manutencao/` — telas do funcionário de manutenção (pasta real,
  não route-group — ver "Parte 02 do projeto").
- `src/lib/actions/minibar.ts` / `poolbar.ts` / `room-bills.ts` — Server
  Actions do frigobar, dos relatórios de bar da piscina e do ciclo de conta
  por quarto (fechar/reabrir/pagar, agora via RPC `security definer`
  checando `is_camareira()` — ver Parte 05 — + a consulta combinada usada
  em `/frigobar` e `/bar-piscina`). Desde a Parte 31, `room-bills.ts`
  também tem `setServiceChargeWaived` (isenção da taxa de 10%, RPC
  `set_room_bill_service_charge_waived`) e `computeBillTotals` recebe um
  `waived` pra zerar a taxa nos totais quando aplicável.
  `poolbar.ts` > `getPoolbarMonthlySummary` (Resumo Executivo) passou, na
  Parte 32, a devolver petiscos e bebidas separados
  (`PoolbarSplitSummary`) — `getPoolbarConsumptionForPeriod` (Histórico)
  não mudou, continua com o total único.
- `src/lib/actions/comandas.ts` — Server Actions das comandas de bar da
  piscina (Parte 05): `submitComanda`/`editComanda`/`cancelComanda` (via
  RPC `security definer`) e as consultas de leitura `getActiveComandas`
  (lista, com itens já embutidos), `getComandaForEdit`,
  `getRoomsForComandaSelector`. Desde a Parte 30, também
  `getBarCommissionByCamareira` (mês atual/anterior calendário, card
  "Comissão Bar" do Resumo Executivo — não mudou) e
  `getBarCommissionByCamareiraForPeriod` (Histórico, e reaproveitada por
  `getBarCommissionScreenSummary`, Parte 37 — mês corrente/último período
  pro card de bar em "Comissões das camareiras") — comissão de 10% por
  camareira responsável (`created_by`), excluindo comandas canceladas e,
  desde a Parte 31, comandas de contas isentas da taxa de serviço.
- `src/lib/commission-math.ts` — `computeWeightedSuitesCafeCommission`
  (Parte 35), função pura (peso = média entre % de serviços e % de nota)
  que reparte um pote em R$ entre camareiras; separada de
  `src/lib/actions/commission.ts` porque um arquivo `"use server"` só
  pode exportar Server Actions assíncronas. Também exporta
  `EXCLUDED_CAMAREIRA_NAME` (`"admin-camareira"`, Parte 36 — conta de
  teste/ajuste do admin, nunca entra em cálculo de comissão) e
  `closedPeriodRange` (Parte 36 — o "último período fechado" pra comissão
  de suítes e café, que fecha sempre no dia 25, não no fim do mês).
- `src/lib/actions/commission.ts` — Server Actions da comissão de
  serviços nas suítes e no café (Parte 35, com os ajustes da Parte 36):
  `updateCamareiraServiceScore` (nota 0-10 de cada camareira, `profiles.
  service_quality_score`), `getSuitesCafeCurrentMonthEstimate`
  (estimativa ao vivo do mês corrente), `calculateClosedPeriodCommissionStatement`
  (grava o demonstrativo congelado do último período fechado em
  `commission_statements`, chave `period_end`), `getClosedPeriodDemonstrativo`
  (lê o último calculado, combinando com a comissão de bar do mesmo
  período, sempre ao vivo), `getSuitesCafeCommissionForPeriod` (Histórico,
  período arbitrário) e `sendCommissionStatementEmail` (reaproveita o
  e-mail/remetente já usados pro recibo de conta). `getCamareiraRoster`
  (interno, Parte 37 — soma camareiras ativas com quem tem serviço
  concluído no período, mesmo já desativada) e `summarizeBarCommissionRows`
  (em `comandas.ts`) excluem `EXCLUDED_CAMAREIRA_NAME` de todo cálculo.
- `src/lib/actions/breakfast-commission.ts` — `getBreakfastCommissionPotForRange`
  (Parte 35), extraído do cálculo que já existia duplicado no Resumo
  Executivo: soma o pote de comissão do café (suítes elegíveis × valor
  por café servido, com fallback e congelamento por mês, Parte 27) num
  intervalo arbitrário de datas.
- `src/lib/commission-statement-pdf.tsx` — gera o PDF do demonstrativo de
  comissões (Parte 35), mesmo padrão `@react-pdf/renderer` do
  `receipt-pdf.tsx`; servido pela rota `/api/dashboard/commission-statement`
  (admin-only) e reaproveitado pelo envio por e-mail.
- `src/lib/room-bills.ts` — helper `getOrCreateCurrentBill` (não é Server
  Action; recebe o client Supabase como parâmetro), usado pelos arquivos de
  actions acima.
- `src/components/ui/accordion.tsx` — wrapper de `@base-ui/react/accordion`
  (ver Parte 04), usado nas telas de bar/frigobar.
- `src/components/shared/comanda-detail-dialog.tsx` — modal de
  visualização dos itens de uma comanda (Parte 05), reaproveitado pela
  tela da camareira e pela aba "Lista de comandas do bar" do admin.
- `src/components/shared/quantity-stepper.tsx` — seletor de quantidade
  +/- (Parte 05, extraído como componente compartilhado na Parte 08):
  usado na comanda de bar e em todo lançamento de frigobar pela camareira
  (`checklist-detail.tsx` e `consumo-quartos-panel.tsx`).
- `src/components/shared/checklist-detail.tsx` — o checklist de uma tarefa
  (arrumação/troca/saída-chegada/somente saída/somente chegada), com
  frigobar, ocorrências e observações; movido pra cá na Parte 10 (antes
  vivia só dentro de `(camareira)/tarefas/[taskId]/`) porque passou a ser
  usado também pela visão somente-leitura do admin em
  `(admin)/dashboard/tarefas/[taskId]/` — o mesmo componente já é
  automaticamente somente-leitura quando `task.status === 'concluido'`. A
  prop `minibar` é opcional, mas desde a Parte 24 a visão do admin **também
  passa essa prop** (reverte a decisão original da Parte 10 de escondê-la
  ali — ver Parte 24 pro motivo).
- `src/app/(camareira)/tarefas/tasks-board.tsx` — cancelar a própria
  escolha de uma suíte (Parte 24, `cancelClaim`/`cancel_own_claimed_task`)
  fica no mesmo componente que já mostrava "Meus quartos"/"Disponíveis
  para escolher" desde a Parte 10.
- `src/app/(admin)/dashboard/` — Resumo Executivo. Desde a Parte 32,
  `page.tsx` só busca dados dos 5 cards de "Consulta rápida do mês
  corrente" ("Comissão Suítes e Café"/"Comissão Bar" desde a Parte 35,
  antes "Comissão do mês"/"10% bar total") e renderiza o menu (mesmo
  padrão de `/checklists`, também com `<SyncStaysAllButton>` desde a
  Parte 34) — o resto virou telas próprias, cada uma com
  `<BackLink href="/dashboard">`: `servicos-suites/` (suítes de hoje/
  amanhã + serviços dos últimos 7 dias, usa `service-log-table.tsx`),
  `suites-disponiveis/` (Parte 33, ver abaixo), `consumo-frigobar/`,
  `consumo-bar/` (petiscos/bebidas separados), `comissoes/` (renomeada de
  `comissao-bar/` na Parte 35 — ver abaixo) e `email-envio/` (novo na
  Parte 35, último item do menu). `monthly-chart.tsx` (o gráfico "Totais
  do mês") foi excluído na Parte 32, sem uso desde então.
- `src/app/(admin)/dashboard/comissoes/` — "Comissões das camareiras"
  (Parte 35; antes "Comissão de 10% do bar por camareira" em
  `comissao-bar/`): duas seções — a tabela de bar
  (`camareira-bar-commission-table.tsx`, Parte 30; colunas "Mês corrente
  (estimativa)"/"Último período (Mês)" desde a Parte 37, sempre
  recalculada ao vivo, sem botão "Calcular" — a comissão de bar não tem
  nenhuma nota editável que precise ser capturada num instante) e o card
  "Comissão de serviços nas suítes e no café"
  (`suites-cafe-commission-panel.tsx`), com o campo "Valor da comissão
  por café servido" (vindo de `/mesas/gerenciar`), a tabela de estimativa
  ao vivo do mês corrente (nota editável via `QuantityStepper`, exceto pra
  "admin-camareira", excluída desde a Parte 36) e o botão "Calcular
  comissão do último período" (Parte 36 — fecha sempre no dia 25, não no
  fim do mês; gera o demonstrativo, com PDF e envio por e-mail). Desde a
  Parte 37, uma camareira que deixou de ser usuária do sistema continua
  aparecendo nas duas tabelas/no demonstrativo pra qualquer período em
  que ela de fato trabalhou.
- `src/app/(admin)/dashboard/email-envio/` — "Cadastrar e-mail de envio"
  (Parte 35): card "E-mail de envio" (`email-envio-settings.tsx`, movido
  de `frigobar/frigobar-rooms-panel.tsx`), mesmo e-mail usado pro recibo
  de conta paga (Parte 06) e pro demonstrativo de comissões (Parte 35).
- `src/app/(admin)/dashboard/suites-disponiveis/page.tsx` — "Suítes vagas
  e limpas, disponíveis para alugar" (Parte 33): duas listas (limpas/
  sujas) calculadas ao vivo a partir de `daily_room_tasks` — suíte com
  serviço de hoje em Troca/Arrumação/Saída com Chegada/Somente Chegada
  fica de fora (ocupada); com Somente Saída, entra como limpa/suja
  conforme o status; sem nenhum serviço hoje (já vaga), olha a última
  tarefa registrada de qualquer tipo e só considera limpa se for
  especificamente uma Somente Saída concluída — ver Parte 33 pro
  raciocínio completo da regra.
- `src/app/(admin)/dashboard/service-log-table.tsx` e
  `src/app/(admin)/historico/history-tables.tsx` — Início/Término/Duração
  do card "Serviços dos últimos 7 dias" e "Duração média" por camareira no
  Histórico (Parte 22, a partir de `daily_room_tasks.claimed_at`/
  `finished_at`); `history-tables.tsx` também tem o cálculo de comissão
  por suíte elegível com fallback/congelamento histórico (Parte 27), e
  desde a Parte 32 a tabela "Por camareira" está dividida em dois cards
  (serviços; e ocorrências + "Comissão Bar" + "Comissão Suítes e Café",
  Parte 35 — a primeira vindo de `getBarCommissionByCamareiraForPeriod`,
  a segunda de `getSuitesCafeCommissionForPeriod`, ambas sempre ao vivo
  pro período do filtro). A coluna "Comissão (R$)" do card "Resumo
  diário" também foi renomeada "Comissão Suítes e Café" na Parte 35, sem
  mudar de cálculo.
- `src/lib/receipt-pdf.tsx` — gera o PDF do recibo de uma conta paga sob
  demanda, sem persistir arquivo (Parte 06), usado tanto pelo e-mail
  automático quanto pela rota `/api/room-bills/[billId]/receipt` ("Ver
  PDF" do admin).
- `src/app/(camareira)/bar-piscina/pix/[roomId]/` — tela de pagamento por
  PIX da camareira (Parte 06): QR code estático (`public/pix-qrcode.png`)
  + valor total da conta.
- `src/lib/actions/` — Server Actions (toda escrita no banco).
- `src/lib/stays/` — integração com a API da Stays (Parte 11 + Parte 13):
  `client.ts` (busca de reservas + `getStaysClientName` pro nome do
  hóspede), `troca-schedule.ts` (fórmula de troca por noites),
  `derive-planning.ts` (deriva o tipo de trabalho de um quarto/dia a
  partir das reservas, e exporta `daysBetween`) e `derive-breakfast.ts`
  (algoritmo de distribuição suíte→mesa por proximidade da vista do mar,
  Parte 13, e `computeTableSizeCounts`, os 4 campos de contagem calculados
  na hora a partir da alocação suíte↔mesa, Parte 16) — todos
  puros/testáveis isolados, sem Server Action neles.
  `src/lib/actions/stays-sync.ts` é quem efetivamente grava no banco:
  `syncStaysPlanning` (Planejamento Diário), `syncStaysArrivalsDepartures`
  (Chegadas & Saídas) e `syncStaysBreakfastTables` (Mesas do Café), todas
  via cliente admin/service-role, todas aceitando `{ force?: boolean }`
  (Parte 14) — sem `force`, respeitam `stays_locked`/lápides normalmente;
  com `force: true`, ignoram (mas nunca ignoram um serviço já reivindicado
  por uma camareira). Todas buscam reservas a partir de **ontem**, não de
  hoje, pra não perder saídas cujo check-out cai exatamente na data
  consultada (Parte 23). `syncStaysAll(options?)` (Parte 34) só chama as
  três em sequência, repassando o mesmo `force` — é o que
  `src/app/(admin)/dashboard/sync-stays-all-button.tsx` chama (dois
  botões: "Sincronização Stays Total - sobrescreve alterações inseridas
  pelo Admin", `force: true`, e "Sincronização Stays Parcial - preserva
  alterações inseridas pelo Admin", `force: false`), único gatilho manual
  desde a Parte 34 — antes existia um `sync-stays-button.tsx` próprio em
  cada uma das três telas, removidos nessa parte por serem sempre
  redundantes com o gatilho único. **E** roda automaticamente 1x/dia via
  `src/app/api/cron/stays-sync/route.ts` + `vercel.json` (sempre sem
  `force`) — ver Parte 14. `syncStaysBreakfastTables` também grava
  `eligible_suites_count`/`commission_value_snapshot` em
  `daily_breakfast_settings` a cada execução, base do cálculo de comissão
  (Parte 27), lido por `getBreakfastCommissionPotForRange`
  (`src/lib/actions/breakfast-commission.ts`, Parte 35) pra somar o pote
  de comissão do café num intervalo arbitrário — usado pelo Resumo
  Executivo, pelo Histórico e pela nova tela "Comissões das camareiras".
- `src/lib/task-type.ts` — rótulos centralizados dos tipos de trabalho
  (Arrumação/Preparação Chegada/Troca) — mudar aqui reflete em todo o app.
- `src/components/shared/back-link.tsx` — link "← Voltar" reutilizável,
  usado nas subtelas de "Listas" e no detalhe de tarefa da camareira.
- `src/app/(admin)/questoes-respostas/page.tsx` — guia de referência em
  linguagem simples pra quem opera o app no dia a dia (Parte 18; revisado
  por completo na Parte 29, e de novo nas Partes 30-33 — comanda
  "responsável" e comissão de 10%, isenção da taxa, e a reestruturação
  inteira do Resumo Executivo) — conteúdo escrito à mão, não gerado a
  partir do código, então precisa ser revisado manualmente sempre que uma
  parte futura mudar algo que uma das perguntas descreve.

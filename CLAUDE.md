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
equivalentes no histórico e no "Resumo executivo".

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

## Convenções e decisões importantes

- **Modelo de planejamento**: o trabalho de um dia é planejado com um dia de
  antecedência (admin usa a aba "Amanhã"); a aba "Hoje" existe para ajustes
  de última hora e testes. Camareiras sempre veem/atuam em "Hoje".
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
  quando existir, igual já é feito para `.insert()`/`.update()`.
- **Fonte de títulos**: "The Seasons" (paga, foundry My Creative Land) não
  foi licenciada ainda — o app usa Playfair Display (Google Fonts) como
  substituta. Trocar em `src/app/layout.tsx` quando os arquivos forem
  adquiridos.
- **Primeiro usuário admin**: não é criado pelo app (a tela "Usuários" só
  cria camareiras e funcionários de manutenção) — precisa ser criado
  manualmente uma única vez via painel do Supabase. Passo a passo no
  `README.md`.

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
  manualmente no SQL Editor, já que este projeto usa **um único projeto
  Supabase** para local e produção (mesma `NEXT_PUBLIC_SUPABASE_URL`/chaves
  em Development, Preview e Production na Vercel — ver `README.md`).

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
- `README.md` — setup local, deploy na Vercel, variáveis de ambiente.
- `supabase/schema.sql` / `supabase/seed.sql` — schema e dados iniciais.
- `supabase/migrations/` — alterações incrementais do banco, em ordem.
- `src/app/(admin)/` — telas do proprietário/admin.
- `src/app/(admin)/checklists/` — submenu "Listas" (ver Parte 03, seção 10):
  `page.tsx` é o menu vertical; `[type]/` (arrumação/troca/preparação),
  `ocorrencias/`, `manutencao-preventiva/`, `quartos/`, `frigobar/`,
  `poolbar/` e `mesas/` (só a aba "Layout & mesas") são as subtelas, cada
  uma com `<BackLink>`.
- `src/app/(admin)/mesas/gerenciar/` — tela "Mesas do café" do menu
  principal (hóspedes de hoje/amanhã + comissão); **não** inclui mais o
  layout arrastável, que é `src/app/(admin)/checklists/mesas/`.
- `src/app/(admin)/frigobar/` — tela "Consumo de Bar e Frigobar" do menu
  principal (ver Parte 04, seção 11): acordeão por quarto com os totais de
  frigobar + bar da piscina e as ações de fechar/reabrir/pagar conta.
- `src/app/(camareira)/bar-piscina/` — tela "Consumo de Bar da Piscina" da
  camareira (ver Parte 04): acordeão com todos os quartos ativos.
- `src/app/(camareira)/` — telas da camareira.
- `src/app/manutencao/` — telas do funcionário de manutenção (pasta real,
  não route-group — ver "Parte 02 do projeto").
- `src/lib/actions/minibar.ts` / `poolbar.ts` / `room-bills.ts` — Server
  Actions do frigobar, do bar da piscina e do ciclo de conta por quarto
  (fechar/reabrir/pagar + a consulta combinada usada em `/frigobar`).
- `src/lib/room-bills.ts` — helper `getOrCreateCurrentBill` (não é Server
  Action; recebe o client Supabase como parâmetro), usado pelos três
  arquivos de actions acima.
- `src/components/ui/accordion.tsx` — wrapper de `@base-ui/react/accordion`
  (ver Parte 04), usado nas telas de bar/frigobar.
- `src/lib/actions/` — Server Actions (toda escrita no banco).
- `src/lib/task-type.ts` — rótulos centralizados dos tipos de trabalho
  (Arrumação/Preparação Chegada/Troca) — mudar aqui reflete em todo o app.
- `src/components/shared/back-link.tsx` — link "← Voltar" reutilizável,
  usado nas subtelas de "Listas" e no detalhe de tarefa da camareira.

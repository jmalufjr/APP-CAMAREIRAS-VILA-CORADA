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
checklists) — implementada e testada em localhost, na branch
`feature/manutencao`, ainda **não mesclada em `main` nem implantada em
produção**. Ver seção "Parte 02 do projeto" abaixo e
`PRD_Camareiras_parte02.md`.

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
   implementada e testada, pendente de merge/deploy — detalhada na seção
   "Parte 02 do projeto" abaixo e em `PRD_Camareiras_parte02.md`):
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
- **Fonte de títulos**: "The Seasons" (paga, foundry My Creative Land) não
  foi licenciada ainda — o app usa Playfair Display (Google Fonts) como
  substituta. Trocar em `src/app/layout.tsx` quando os arquivos forem
  adquiridos.
- **Primeiro usuário admin**: não é criado pelo app (a tela "Usuários" só
  cria camareiras e funcionários de manutenção) — precisa ser criado
  manualmente uma única vez via painel do Supabase. Passo a passo no
  `README.md`.

## Parte 02 do projeto: módulo de Manutenção (implementada, aguardando merge/deploy)

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
ambos ponta a ponta). O banco de dados já está pronto (as migrations foram
rodadas contra o mesmo projeto Supabase único usado por local e produção —
ver nota abaixo). Vive na branch `feature/manutencao`, alguns commits à
frente de `main`. **Ainda não mesclada em `main` nem implantada em
produção** — falta só o merge do código e o deploy.

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
  e `011_manutencao_preventiva_por_semana.sql` foram rodadas durante os
  testes em localhost, e como este projeto usa **um único projeto Supabase**
  para local e produção (mesma `NEXT_PUBLIC_SUPABASE_URL`/chaves em
  Development, Preview e Production na Vercel — ver `README.md`), o banco
  que a produção vai usar já está pronto. Não é preciso rodar nada de novo
  no Supabase para o deploy desta parte — só mesclar e implantar o código.

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

### Regras específicas desta parte 02

- Não mudar nada fora do escopo de manutenção sem pedir autorização antes
  ao proprietário (instrução explícita dele em `PRD_Camareiras_parte02.md`
  seção 2.3) — regra que segue valendo até o merge/deploy estarem feitos.
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
- `src/app/(camareira)/` — telas da camareira.
- `src/app/manutencao/` — telas do funcionário de manutenção (pasta real,
  não route-group — ver "Parte 02 do projeto").
- `src/lib/actions/` — Server Actions (toda escrita no banco).
- `src/lib/task-type.ts` — rótulos centralizados dos tipos de trabalho
  (Arrumação/Preparação Chegada/Troca) — mudar aqui reflete em todo o app.

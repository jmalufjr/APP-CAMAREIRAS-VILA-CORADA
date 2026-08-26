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
chegadas/saídas do dia e comissão da equipe. Uma segunda parte do projeto,
planejada mas ainda não implementada, adiciona um módulo completo de
manutenção corretiva e preventiva — ver seção "Parte 02 do projeto" abaixo e
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
  `NEXT_PUBLIC_*` são as únicas expostas ao navegador. RLS ativa em todas as
  tabelas — admin tem acesso total, camareira só ao que é seu/disponível.
- **Fonte de títulos**: "The Seasons" (paga, foundry My Creative Land) não
  foi licenciada ainda — o app usa Playfair Display (Google Fonts) como
  substituta. Trocar em `src/app/layout.tsx` quando os arquivos forem
  adquiridos.
- **Primeiro usuário admin**: não é criado pelo app (só camareiras são
  criadas pela tela de Camareiras) — precisa ser criado manualmente uma
  única vez via painel do Supabase. Passo a passo no `README.md`.

## Parte 02 do projeto: módulo de Manutenção (planejado, não iniciado)

> Requisitos completos (texto integral do proprietário) em
> `PRD_Camareiras_parte02.md`. Esta seção é o resumo de retomada rápida —
> ler o PRD parte02 antes de começar a codificar qualquer etapa abaixo, pois
> ele contém detalhes finos (ex.: os dois checklists por trabalho de
> manutenção preventiva) que não cabem neste resumo.

**Objetivo**: incluir controle de manutenção corretiva (ocorrências
imediatas identificadas pelas camareiras) e preventiva (agenda de
manutenção programada por categoria/item), com um novo papel de usuário
"Funcionário de Manutenção" responsável por essas telas.

**Status em 2026-08-26**: em desenvolvimento na branch `feature/manutencao`
(ainda não mesclada em `main`, ainda não implantada). Etapas 1–5 abaixo estão
implementadas e passam em `npm run build`/`npm run lint`; **falta rodar a
migration em Supabase e testar em localhost antes de prosseguir** (ver
"Como retomar" no fim desta seção). Etapas 6–11 (manutenção preventiva) ainda
não foram iniciadas — as telas `/manutencao/preventiva` (funcionário) e
`/manutencao-preventiva` (admin) existem apenas como placeholder "Em
desenvolvimento".

### Etapas de desenvolvimento planejadas (ordem sugerida)

1. Novo papel `manutencao` no schema/RLS/middleware + route-group
   `src/app/(manutencao)/` com sidebar própria (mesmo padrão de
   `(camareira)/`).
2. Renomear tela/menu "Camareiras" → "Usuários" no admin; formulário de
   cadastro ganha seletor de papel (Camareira / Funcionário de Manutenção),
   reaproveitando o fluxo de criação via Supabase Auth Admin API já
   existente.
3. Ciclo de vida de ocorrências de manutenção: status
   `pendente → selecionada → resolvida`, com funcionário que
   selecionou/resolveu, data/hora de cadastro e data/hora de resolução.
4. Tela do funcionário de manutenção "Ocorrências de Manutenção": lista
   (hoje + ontem) com quarto, categoria, descrição, camareira, data/hora;
   selecionar ocorrência (some das opções dos demais) e depois marcar
   resolvida (some da tela quando resolvida).
5. Atualizar telas do admin já existentes: `/ocorrencias` e
   `/ocorrencias/[data]` passam a mostrar status + data/hora de
   cadastro e de resolução; `/ocorrencias/historico` (30 dias) e
   `/historico` geral ganham coluna de quantidade **resolvida** logo após a
   coluna de quantidade de ocorrências.
6. Modelagem de manutenção preventiva: tabelas de categorias, itens
   (periodicidade, descrição, execução técnico externo/não técnico
   interno) e agendamentos/execuções programadas com o mesmo sistema de
   status (pendente/selecionada/concluída) das ocorrências; rotina que
   garante ocorrências futuras geradas cobrindo pelo menos os próximos 60
   dias a partir da periodicidade.
7. Seed das 9 categorias fixas definidas pelo proprietário (ar
   condicionados, boiler da casa, boiler do prédio, bombas pressurizadoras,
   bomba de irrigação, cisterna, bomba do poço, fossa séptica prédio, fossa
   séptica chalés) com até 10 itens cada, propostos por boas práticas do
   setor (hotelaria/administração predial), sujeitos a revisão do admin.
8. Tela do admin para CRUD de categorias/itens de manutenção (análoga à
   tela existente de Checklists & Ocorrências).
9. Tela do funcionário de manutenção "Manutenção Preventiva": trabalhos de
   hoje/amanhã com o mesmo fluxo de seleção/status das ocorrências; link
   para tela de checklist de cada trabalho contendo **dois** checklists —
   um com os itens não técnicos (marcáveis, registrando quem e quando
   concluiu) e outro com os itens técnicos externos (somente leitura, mas
   com campo de texto para o nome do técnico externo e registro de quem do
   time de manutenção supervisionou + data de conclusão); mais abaixo,
   resumo dos próximos 30 dias.
10. Novo item de menu do admin "Manutenção Preventiva": detalhamento de
    hoje/amanhã (categoria, item, data prevista, tempo restante, status,
    data de conclusão, executante/responsável, técnico externo se houver) e
    resumo dos próximos dois meses (dia a dia, separado técnico/não
    técnico).
11. Revisão de segurança e teste ponta a ponta (RLS por papel, chaves nunca
    expostas ao client) antes de deploy — rodar skill `security-audit`.

### Como retomar (estado real do código nesta branch)

- Rotas novas: `src/app/manutencao/` (pasta real, **não** route-group —
  cuidado: um route-group `(manutencao)` foi tentado primeiro e colidiu com
  `/ocorrencias` do admin porque parênteses não viram segmento de URL;
  por isso as telas do funcionário de manutenção ficam em
  `src/app/manutencao/ocorrencias` e `src/app/manutencao/preventiva`, com
  layout próprio em `src/app/manutencao/layout.tsx`) e
  `src/app/(admin)/manutencao-preventiva/`.
- Tela "Camareiras" foi renomeada e movida para
  `src/app/(admin)/usuarios/` (`page.tsx`, `users-table.tsx`,
  `user-form-dialog.tsx`); as Server Actions foram renomeadas de
  `src/lib/actions/camareiras.ts` para `src/lib/actions/users.ts`
  (`createUser`/`updateUser`/`resetUserPassword`/`deleteUser`, todas aceitam
  `role: "camareira" | "manutencao"`).
- Ciclo de vida das ocorrências implementado em
  `src/lib/actions/occurrences.ts` (`getManutencaoOccurrences`,
  `selectOccurrence`, `resolveOccurrence`) + RLS em `supabase/schema.sql` e
  `supabase/migrations/008_funcionario_manutencao.sql` (rodar em duas
  etapas no SQL Editor do Supabase, igual ao padrão do migration 003).
  **Esta migration ainda não foi rodada no projeto Supabase** — é o próximo
  passo obrigatório antes de testar em localhost, porque o app já assume
  as colunas/policies novas em produção do schema.
- Depois de rodar a migration: testar em localhost (`npm run dev`) o fluxo
  completo — admin cria um "Funcionário de Manutenção" em `/usuarios`, faz
  login como esse usuário, camareira registra uma ocorrência normalmente,
  o funcionário a seleciona e resolve em `/manutencao/ocorrencias`, e o
  admin confere o status/horários em `/ocorrencias`, a coluna "Resolvidas"
  em `/ocorrencias/historico` e as colunas novas em `/historico` — só então
  seguir para as etapas 6–11 e, ao final de tudo, mesclar em `main` e
  implantar.

### Regras específicas desta parte 02

- Não mudar nada fora do escopo de manutenção acima sem pedir autorização
  antes ao proprietário (instrução explícita dele em
  `PRD_Camareiras_parte02.md` seção 2.3).
- Manter estritamente a mesma identidade visual e padrões de tela/menu já
  usados na parte 1 — sem paletas, temas ou componentes novos.
- Atualizar a seção 4 (changelog) do `PRD_Camareiras_parte02.md` a cada
  decisão relevante tomada durante a implementação, do mesmo jeito que a
  seção 8 do `PRD_Camareiras_parte01.md` documenta a parte 1.

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
  Manutenção (parte 2, planejada, ver seção acima) + changelog a ser
  preenchido durante a implementação.
- `README.md` — setup local, deploy na Vercel, variáveis de ambiente.
- `supabase/schema.sql` / `supabase/seed.sql` — schema e dados iniciais.
- `supabase/migrations/` — alterações incrementais do banco, em ordem.
- `src/app/(admin)/` — telas do proprietário/admin.
- `src/app/(camareira)/` — telas da camareira.
- `src/lib/actions/` — Server Actions (toda escrita no banco).
- `src/lib/task-type.ts` — rótulos centralizados dos tipos de trabalho
  (Arrumação/Preparação Chegada/Troca) — mudar aqui reflete em todo o app.

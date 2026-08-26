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
chegadas/saídas do dia e comissão da equipe.

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

## Onde encontrar cada coisa

- `PRD_Camareiras_parte01.md` — requisitos completos + changelog detalhado.
- `README.md` — setup local, deploy na Vercel, variáveis de ambiente.
- `supabase/schema.sql` / `supabase/seed.sql` — schema e dados iniciais.
- `supabase/migrations/` — alterações incrementais do banco, em ordem.
- `src/app/(admin)/` — telas do proprietário/admin.
- `src/app/(camareira)/` — telas da camareira.
- `src/lib/actions/` — Server Actions (toda escrita no banco).
- `src/lib/task-type.ts` — rótulos centralizados dos tipos de trabalho
  (Arrumação/Preparação Chegada/Troca) — mudar aqui reflete em todo o app.

# Camareiras Vila Corada

Web app de gestão do serviço de camareiras da pousada Vila Corada — arrumação e
preparação de quartos, layout do café da manhã e comissão da equipe.

Stack: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase
(Postgres + Auth + RLS) + Recharts. Deploy recomendado: Vercel.

## 1. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute nesta ordem:
   - `supabase/schema.sql` — cria tabelas, enums e as políticas de RLS.
   - `supabase/seed.sql` — cria os 11 quartos, os itens de checklist (base no
     "Check List.pdf"), as categorias de ocorrências (do PRD) e as 9 mesas do
     café da manhã (layout do "Layout das Mesas.pdf").
3. Em **Project Settings → API**, copie a `Project URL`, a `anon public key` e
   a `service_role key`.

## 2. Configurar variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha os três valores do
passo anterior. `SUPABASE_SERVICE_ROLE_KEY` nunca é exposta ao navegador — é
usada só em Server Actions para criar/editar login das camareiras.

## 3. Criar o usuário admin (bootstrap)

O cadastro de camareiras é feito pelo próprio app, mas o primeiro usuário
admin precisa ser criado manualmente, uma única vez:

1. No painel do Supabase, vá em **Authentication → Users → Add user**.
   - E-mail: `admin@camareiras.vilacorada.app`
   - Senha: defina a senha do proprietário/admin.
   - Marque "Auto Confirm User".
2. Copie o `UID` do usuário criado.
3. No **SQL Editor**, rode (substituindo `SEU-UID-AQUI`):

```sql
insert into profiles (id, role, name, login_email)
values ('SEU-UID-AQUI', 'admin', 'admin', 'admin@camareiras.vilacorada.app');
```

Na tela de login, o campo "usuário" já mostrará a opção **admin** e os nomes
das camareiras cadastradas (nada precisa ser digitado, só selecionado).

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000.

## 5. Deploy na Vercel

Conecte o repositório no [vercel.com](https://vercel.com), configure as
mesmas 3 variáveis de ambiente do `.env.local` no painel do projeto e faça o
deploy. Cada push na branch principal gera um novo deploy automaticamente.

## Fonte de títulos "The Seasons"

O PRD pede a fonte paga **The Seasons** para títulos. Como o arquivo da fonte
não está disponível no projeto, o app usa **Playfair Display** (Google Fonts)
como substituta visual — mesma proporção serifada de alto contraste. Para
usar a fonte oficial, adicione os arquivos (.woff2) em `src/app/fonts/` e
troque a declaração em `src/app/layout.tsx` de `Playfair_Display` (next/font/google)
para `localFont` (next/font/local) apontando para os arquivos.

## Estrutura

- `supabase/schema.sql` / `supabase/seed.sql` — banco de dados.
- `src/app/(admin)/` — páginas do proprietário/admin: dashboard, planejamento
  diário, quartos, mesas, checklists/ocorrências, camareiras, histórico.
- `src/app/(camareira)/` — páginas da camareira: meus quartos (checklist) e
  visualização das mesas do café.
- `src/lib/actions/` — Server Actions (mutações no banco).
- `src/lib/supabase/` — clientes Supabase (browser, server, admin, middleware).

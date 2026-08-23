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

1. Em [vercel.com](https://vercel.com), clique em **Add New → Project** e
   importe o repositório `jmalufjr/APP-CAMAREIRAS-VILA-CORADA` do GitHub.
2. A Vercel detecta automaticamente que é um projeto Next.js — não precisa
   mudar nada em build/output settings.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione as
   três, com os mesmos valores do seu `.env.local`:

   | Nome | Valor | Environments |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_...`) | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_...`) | Production, Preview, Development |

4. Clique em **Deploy**. Cada push na branch `main` gera um novo deploy
   automaticamente depois disso.
5. Depois do primeiro deploy, copie a URL gerada (ex.:
   `https://app-camareiras-vila-corada.vercel.app`) e cole em
   **Supabase → Authentication → URL Configuration → Site URL**, para manter
   a configuração de autenticação consistente com o domínio de produção.

### Segurança das chaves

As duas variáveis `NEXT_PUBLIC_*` são seguras para expor ao navegador por
design — o prefixo `NEXT_PUBLIC_` é o que instrui o Next.js a incluí-las no
bundle do cliente; sem esse prefixo, uma variável de ambiente só existe no
servidor. `SUPABASE_SERVICE_ROLE_KEY` **não tem** esse prefixo de propósito:
ela ignora as políticas de RLS e só pode ser usada no servidor. No código
deste projeto ela é lida apenas dentro de `src/lib/supabase/admin.ts`, que só
é importado por Server Actions marcadas com `"use server"` (`auth.ts` e
`camareiras.ts`, usadas para criar/editar login das camareiras) — o Next.js
garante que esse código nunca é enviado ao navegador. Não crie nenhum
componente `"use client"` que importe `admin.ts` ou leia
`process.env.SUPABASE_SERVICE_ROLE_KEY` diretamente.

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

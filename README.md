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

O app em produção usa o projeto Supabase da nuvem (seção 5). Para
desenvolver/testar em `localhost` **sem gravar nada no banco real**, este
projeto usa o Supabase rodando localmente via Docker (Supabase CLI) —
configurado uma vez, setembro/2026 (ver `supabase/config.toml`).

### 4.1 Pré-requisito: Docker Desktop

Instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/)
e deixe-o aberto (ícone da baleia parado na bandeja do Windows = motor
rodando). No Windows, ele usa o WSL2 por baixo; se aparecer erro de
"Virtualization support not detected", a virtualização (Intel VT-x/AMD-V)
está desligada na BIOS/UEFI do computador e precisa ser habilitada lá antes
(fora do alcance do Docker/Windows resolver sozinho).

### 4.2 Subir o banco local (só na primeira vez, ou depois de `supabase stop`)

```bash
npx supabase start
```

Isso sobe um Postgres + Auth completos, isolados, na sua máquina (baixa as
imagens Docker na primeira vez — demora alguns minutos). **Importante**:
`supabase/config.toml` tem `[db.migrations] enabled = false` e
`[db.seed] enabled = false` de propósito — `supabase/migrations/` começa em
`002` (não existe uma migration `001`, porque o schema inicial deste projeto
foi aplicado direto no painel da nuvem antes de existir o CLI), então
replay automático de migrations quebraria num banco vazio. Por isso o schema
é aplicado manualmente, só uma vez, direto no Postgres do container:

```bash
docker exec -i supabase_db_APP_Camareiras_Vila_Corada psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/schema.sql
docker exec -i supabase_db_APP_Camareiras_Vila_Corada psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/seed.sql
```

(`supabase start` já imprime as credenciais locais — `.env.local` já está
configurado com elas, não precisa copiar de novo.)

Crie o usuário admin local (equivalente ao passo 3, mas no banco local — as
credenciais abaixo já valem tanto para o Studio local quanto para logar no
app; troque a senha se quiser):

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "apikey: SUPABASE_SERVICE_ROLE_KEY-do-.env.local" \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY-do-.env.local" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@camareiras.vilacorada.app","password":"admin123","email_confirm":true}'
```

e depois insira o perfil (substitua `SEU-UID-AQUI` pelo `id` retornado
acima):

```bash
docker exec -i supabase_db_APP_Camareiras_Vila_Corada psql -U postgres -d postgres -c "insert into profiles (id, role, name, login_email) values ('SEU-UID-AQUI', 'admin', 'admin', 'admin@camareiras.vilacorada.app');"
```

### 4.3 Rodar o app

```bash
npm install
npm run dev
```

Acesse http://localhost:3000 — login **admin**, senha `admin123` (a que foi
definida acima). Painel do Studio local (equivalente ao painel do Supabase
na nuvem, pra ver tabelas visualmente): http://127.0.0.1:54323. E-mails que
o app tentaria mandar localmente (recibo de PDF) ficam capturados em
http://127.0.0.1:54324 em vez de saírem de verdade — `.env.local` local
propositalmente não tem `RESEND_API_KEY` configurada, então o envio
automático apenas falha silenciosamente (por design, nunca bloqueia o
pagamento) em vez de mandar e-mail de teste pra conta real da contabilidade.

### 4.4 Zerar os dados de teste / parar

```bash
npx supabase stop          # desliga os containers (dados locais ficam salvos)
npx supabase stop --no-backup && npx supabase start   # zera tudo e sobe de novo vazio (precisa reaplicar 4.2)
```

`.env.local` aponta para o banco local por padrão agora. As credenciais do
projeto de produção ficam guardadas em `.env.local.cloud` (nunca versionado)
só para o caso raro de precisar rodar localmente contra o banco real —
copie o conteúdo por cima de `.env.local` temporariamente e desfaça depois.

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

## 6. Integração com a Stays (reservas)

A partir de setembro/2026 o app passou a consumir dados de reserva da API
externa da Stays (sistema de reservas da pousada) — ver
`PRD_regrasdenegocio.md` pras regras completas de como esses dados viram
planejamento diário, chegadas/saídas e mesas do café.

### 6.1 Obter as credenciais

No painel da Stays (`https://SUA-CONTA.stays.net`):
**App Center → Todos os Apps Disponíveis → API Externo → Chaves da API**.
Essa tela mostra:

- **URL do sistema** — o subdomínio da própria conta (ex.:
  `https://jmj.stays.net`). A API é acessada em
  `{URL do sistema}/external/v1/...` — **não** existe um host genérico
  compartilhado da Stays, cada conta usa o próprio subdomínio.
- **Login** e **Senha**, na seção "Autorização" — são o `client_id`/
  `client_secret` usados na autenticação Basic Auth da API (`curl -u
  "login:senha" ...`), apesar do nome "Login/Senha" sugerir outra coisa.

### 6.2 Variáveis de ambiente

```
STAYS_BASE_URL=https://sua-conta.stays.net
STAYS_CLIENT_ID=login-mostrado-na-tela-de-chaves-da-api
STAYS_CLIENT_SECRET=senha-mostrada-na-tela-de-chaves-da-api
```

Mesmas três variáveis em `.env.local` (dev local) e `.env.local.cloud`
(backup de produção) — a conta Stays é a mesma independente de qual
Supabase o app está usando. Quando a integração for pro ar, essas três
também precisam ser adicionadas na Vercel (seção 5, mesmo processo das
demais).

### 6.3 Mapeamento quarto ↔ listing da Stays

Cada quarto do app corresponde a um "listing" na Stays. A conta da pousada
tem exatamente 11 listings, nomeados "Suite 01" a "Suite 11" — o número já
bate exatamente com o número do quarto no app (`rooms.number`), sem
ambiguidade. O identificador usado (`rooms.stays_listing_id`, coluna
adicionada por `supabase/migrations/029_stays_listing_ids.sql`) é o campo
`_id` retornado por `GET /external/v1/content/listings` (formato longo,
tipo `678819a8124ceee95d3c8cbb`) — é esse mesmo valor que aparece no campo
`_idlisting` de cada reserva. **Não** confundir com o campo curto `id`
(tipo `RI01I`), que é só um código interno da Stays.

Se a pousada adicionar/remover uma suíte no futuro, é preciso repetir essa
consulta e atualizar `stays_listing_id` do quarto correspondente
manualmente (não há descoberta automática desse mapeamento).

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

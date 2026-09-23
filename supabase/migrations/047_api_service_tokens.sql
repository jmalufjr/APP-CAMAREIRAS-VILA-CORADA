-- Tokens de acesso de serviço pra API externa de consumos
-- (PRD_consumos-api-joao-v1.md, item 5) — nunca guardamos o token em texto
-- puro, só o hash SHA-256; o valor real só é mostrado uma vez, no momento
-- da criação, na tela do admin.
create table api_service_tokens (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  revoked_at timestamptz
);

alter table api_service_tokens enable row level security;

-- Gestão (listar/criar/revogar) é sempre pelo admin, via sessão normal do
-- app. A validação da própria API externa (rotas /api/integration/v1/*)
-- roda com o client admin/service-role, sem passar por RLS — mesmo padrão
-- já usado pela integração com a Stays.
create policy api_service_tokens_admin_all on api_service_tokens
  for all using (is_admin()) with check (is_admin());

-- Registro de uso do tradutor de voz: serve para limitar o gasto por usuário por dia e para acompanhar o custo.
create table if not exists translator_calls (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  direction text not null,
  lang text,
  audio_ms int,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists translator_calls_user_day_idx on translator_calls (user_id, created_at);

alter table translator_calls enable row level security;
drop policy if exists translator_calls_admin_select on translator_calls;
create policy translator_calls_admin_select on translator_calls for select using (is_admin_or_gerente());

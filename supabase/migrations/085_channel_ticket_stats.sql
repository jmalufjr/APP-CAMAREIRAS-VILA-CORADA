-- 085: Ticket médio de canais de venda (Stays)
-- - channel_price_settings: percentual de "correção de preço" de cada canal (o mesmo
--   número que fica em Dashboard de Channel Managers > Configurações > Financeiro na
--   Stays; a API da Stays não o expõe, então o admin o digita aqui).
-- - channel_ticket_stats: resultado da sincronização por grupo de suítes, canal e mês
--   (diárias reservadas, valor cobrado nessas diárias e preço base médio cadastrado).

create table if not exists channel_price_settings (
  channel text primary key check (channel in ('booking', 'airbnb', 'expedia', 'decolar', 'direta')),
  correction_pct numeric,
  updated_at timestamptz not null default now()
);

insert into channel_price_settings (channel, correction_pct) values
  ('booking', null), ('airbnb', 38), ('expedia', null), ('decolar', null), ('direta', 0)
on conflict (channel) do nothing;

alter table channel_price_settings enable row level security;
drop policy if exists cps_admin_all on channel_price_settings;
create policy cps_admin_all on channel_price_settings for all using (is_admin()) with check (is_admin());

create table if not exists channel_ticket_stats (
  group_key text not null check (group_key in ('g1', 'g2', 'g3', 'g4')),
  channel text not null check (channel in ('booking', 'airbnb', 'expedia', 'decolar', 'direta')),
  month date not null,
  nights integer not null default 0,
  charged_total numeric not null default 0,
  base_avg numeric,
  base_days integer not null default 0,
  synced_at timestamptz not null default now(),
  primary key (group_key, channel, month)
);

-- Só o admin lê; a gravação é feita pela sincronização (service role, que ignora RLS).
alter table channel_ticket_stats enable row level security;
drop policy if exists cts_admin_select on channel_ticket_stats;
create policy cts_admin_select on channel_ticket_stats for select using (is_admin());

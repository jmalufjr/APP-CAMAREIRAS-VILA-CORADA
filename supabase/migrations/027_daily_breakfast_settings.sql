-- Configuração geral (não por mesa) do café da manhã de um dia: total de
-- mesas definido pelo admin e uma observação única do dia, exibidos para a
-- camareira acima do layout de mesas. Complementa (não substitui)
-- daily_breakfast, que continua guardando hóspedes/observação por mesa.
create table daily_breakfast_settings (
  date date primary key,
  total_tables int not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);
alter table daily_breakfast_settings enable row level security;

create policy "dbs_select_authenticated" on daily_breakfast_settings for select using (auth.uid() is not null);
create policy "dbs_admin_write" on daily_breakfast_settings for insert with check (is_admin());
create policy "dbs_admin_update" on daily_breakfast_settings for update using (is_admin());
create policy "dbs_admin_delete" on daily_breakfast_settings for delete using (is_admin());

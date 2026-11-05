-- Indicadores (ADR, RevPAR, NetRevPAR, ocupacao): base mensal vinda da Stays + comissao por canal.
create table if not exists indicator_months (
  month date primary key,                    -- primeiro dia do mes
  rooms int not null,                        -- suites no mes
  blocked_nights int not null default 0,
  maintenance_nights int not null default 0,
  synced_at timestamptz not null default now()
);

create table if not exists indicator_month_channels (
  month date not null references indicator_months(month) on delete cascade,
  channel text not null,                     -- booking, airbnb, expedia, decolar, direta, outros
  paid_nights int not null default 0,
  free_nights int not null default 0,
  revenue numeric(14,2) not null default 0,  -- receita bruta de hospedagem, sem impostos/taxas
  primary key (month, channel)
);

-- Percentual de comissao por canal (informado pelo admin); aplicado na hora de exibir.
create table if not exists channel_commissions (
  channel text primary key,
  percent numeric(5,2) not null default 0 check (percent >= 0 and percent <= 100),
  updated_at timestamptz not null default now()
);
insert into channel_commissions (channel) values ('booking'), ('airbnb'), ('expedia'), ('decolar'), ('direta'), ('outros')
on conflict do nothing;

alter table indicator_months enable row level security;
alter table indicator_month_channels enable row level security;
alter table channel_commissions enable row level security;
drop policy if exists indicator_months_select on indicator_months;
create policy indicator_months_select on indicator_months for select using (is_admin());
drop policy if exists indicator_month_channels_select on indicator_month_channels;
create policy indicator_month_channels_select on indicator_month_channels for select using (is_admin());
drop policy if exists channel_commissions_select on channel_commissions;
create policy channel_commissions_select on channel_commissions for select using (is_admin());
drop policy if exists channel_commissions_update on channel_commissions;
create policy channel_commissions_update on channel_commissions for update using (is_admin()) with check (is_admin());

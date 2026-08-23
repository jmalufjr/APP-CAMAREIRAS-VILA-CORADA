-- ============================================================================
-- Migração: Chegadas e Saídas do dia (tela exclusiva do admin, leitura para
-- as camareiras). Pode ser executada em um único "Run" no SQL Editor.
-- ============================================================================

create table daily_arrivals (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  guest_name text not null,
  expected_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, room_id)
);

create table daily_departures (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, room_id)
);

alter table daily_arrivals enable row level security;
alter table daily_departures enable row level security;

create policy "da_select_authenticated" on daily_arrivals for select using (auth.uid() is not null);
create policy "da_admin_write" on daily_arrivals for insert with check (is_admin());
create policy "da_admin_update" on daily_arrivals for update using (is_admin());
create policy "da_admin_delete" on daily_arrivals for delete using (is_admin());

create policy "dd_select_authenticated" on daily_departures for select using (auth.uid() is not null);
create policy "dd_admin_write" on daily_departures for insert with check (is_admin());
create policy "dd_admin_update" on daily_departures for update using (is_admin());
create policy "dd_admin_delete" on daily_departures for delete using (is_admin());

-- Associa uma ou mais suítes a uma mesa do café, por dia — permite a Mesa 7
-- (maior capacidade) receber mais de uma suíte (ver PRD_regrasdenegocio.md
-- seção 4). Uma suíte só pode estar em uma mesa por dia (unique em
-- date+room_id). Complementa daily_breakfast (que continua guardando o
-- total de hóspedes da mesa, ainda editado manualmente) — de propósito não
-- soma automaticamente, evitando um recálculo implícito arriscado nesta
-- primeira versão; ver nota em CLAUDE.md.
create table daily_breakfast_room_assignments (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  table_id uuid not null references breakfast_tables(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  guest_count int not null default 0 check (guest_count >= 0),
  created_at timestamptz not null default now(),
  unique (date, room_id)
);
alter table daily_breakfast_room_assignments enable row level security;

create policy "dbra_select_authenticated" on daily_breakfast_room_assignments for select using (auth.uid() is not null);
create policy "dbra_admin_write" on daily_breakfast_room_assignments for insert with check (is_admin());
create policy "dbra_admin_update" on daily_breakfast_room_assignments for update using (is_admin());
create policy "dbra_admin_delete" on daily_breakfast_room_assignments for delete using (is_admin());

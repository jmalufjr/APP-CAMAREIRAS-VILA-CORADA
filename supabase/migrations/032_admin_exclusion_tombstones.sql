-- "Lápides" de exclusão explícita do admin (ver PRD_regrasdenegocio.md
-- seção 1 e CLAUDE.md Parte 15): permitem que o admin apague uma linha
-- sincronizável (tarefa do Planejamento Diário / alocação suíte↔mesa) sem
-- que a sincronização automática (cron) ou manual não forçada recrie essa
-- linha depois — mesmo sem sobrar nenhuma linha "viva" pra carregar um
-- stays_locked. A sincronização **forçada** (botão "Forçar sincronização
-- com a Stays") ignora essas lápides de propósito, do mesmo jeito que já
-- ignora stays_locked — e as remove ao criar uma linha de verdade no lugar,
-- pra não deixar lixo obsoleto na tabela.

create table daily_room_task_exclusions (
  date date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (date, room_id)
);
alter table daily_room_task_exclusions enable row level security;
create policy "drte_select_authenticated" on daily_room_task_exclusions for select using (auth.uid() is not null);
create policy "drte_admin_insert" on daily_room_task_exclusions for insert with check (is_admin());
create policy "drte_admin_delete" on daily_room_task_exclusions for delete using (is_admin());

create table daily_breakfast_room_exclusions (
  date date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (date, room_id)
);
alter table daily_breakfast_room_exclusions enable row level security;
create policy "dbre_select_authenticated" on daily_breakfast_room_exclusions for select using (auth.uid() is not null);
create policy "dbre_admin_insert" on daily_breakfast_room_exclusions for insert with check (is_admin());
create policy "dbre_admin_delete" on daily_breakfast_room_exclusions for delete using (is_admin());

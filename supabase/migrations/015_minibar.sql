-- Consumo de frigobar: catálogo de itens (editável pelo admin em "Listas"),
-- consumo registrado pela camareira por tarefa/dia (price_snapshot preserva
-- o preço vigente na hora do registro, mesmo se o item mudar de preço
-- depois) e "contas" por quarto que acumulam até o admin fechar e marcar
-- como paga.
create type minibar_bill_status as enum ('fechada', 'paga');

create table minibar_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table daily_room_task_minibar (
  id uuid primary key default uuid_generate_v4(),
  daily_room_task_id uuid not null references daily_room_tasks(id) on delete cascade,
  minibar_item_id uuid not null references minibar_items(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  price_snapshot numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_room_task_id, minibar_item_id)
);

-- Uma "conta" fecha o período de consumo em aberto de um quarto (desde a
-- última conta fechada/paga até o momento) e congela o total; ao marcar
-- como paga, o período seguinte já nasce zerado (consumo com data após
-- period_end de qualquer conta anterior conta como "em aberto" de novo).
create table minibar_bills (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total numeric(10,2) not null default 0,
  status minibar_bill_status not null default 'fechada',
  closed_at timestamptz not null default now(),
  closed_by uuid references profiles(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references profiles(id) on delete set null
);

insert into minibar_items (name, price, position) values
  ('Água sem gás', 5.00, 1),
  ('Água com gás', 6.00, 2),
  ('Refrigerante', 10.00, 3),
  ('Cerveja', 12.00, 4),
  ('Café expresso', 7.00, 5);

alter table minibar_items enable row level security;
alter table daily_room_task_minibar enable row level security;
alter table minibar_bills enable row level security;

-- minibar_items: todo autenticado lê (camareira usa a lista); só admin edita
create policy "mbi_select_authenticated" on minibar_items for select using (auth.uid() is not null);
create policy "mbi_admin_write" on minibar_items for insert with check (is_admin());
create policy "mbi_admin_update" on minibar_items for update using (is_admin());
create policy "mbi_admin_delete" on minibar_items for delete using (is_admin());

-- daily_room_task_minibar: admin full; camareira lê/grava só das próprias tarefas
create policy "drtm_admin_all" on daily_room_task_minibar for all using (is_admin()) with check (is_admin());
create policy "drtm_camareira_select" on daily_room_task_minibar for select
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));
create policy "drtm_camareira_insert" on daily_room_task_minibar for insert
  with check (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));
create policy "drtm_camareira_update" on daily_room_task_minibar for update
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()))
  with check (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));

-- minibar_bills: só admin usa (fechar conta / marcar como paga)
create policy "mb_admin_all" on minibar_bills for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- Camareiras Vila Corada - Schema do banco de dados (Supabase / PostgreSQL)
-- Execute este arquivo no SQL Editor do Supabase (projeto novo, schema public)
-- ============================================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "uuid-ossp";

-- ---------- ENUMS ----------
create type user_role as enum ('admin', 'camareira', 'manutencao');
create type checklist_type as enum ('arrumacao', 'preparacao', 'troca');
create type task_status as enum ('pendente', 'em_andamento', 'concluido');
create type table_shape as enum ('round', 'rect');
create type occurrence_status as enum ('pendente', 'selecionada', 'resolvida');
create type maintenance_execution_type as enum ('nao_tecnico', 'tecnico');
create type maintenance_item_status as enum ('pendente', 'selecionada');
create type room_bill_status as enum ('aberta', 'fechada', 'reaberta', 'paga');

-- ---------- PROFILES ----------
-- Espelha auth.users com dados de perfil e papel (admin | camareira)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'camareira',
  name text not null,
  phone text,
  email text, -- e-mail de contato (cadastro da camareira)
  login_email text not null unique, -- e-mail sintético usado apenas para autenticação (auth.users.email)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- ROOMS (Quartos) ----------
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  number text not null unique,
  name text,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- CHECKLIST ITEMS (catálogo global de itens) ----------
create table checklist_items (
  id uuid primary key default uuid_generate_v4(),
  type checklist_type not null,
  label text not null,
  description text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- ROOM <-> CHECKLIST ITEM (itens próprios de cada quarto) ----------
create table room_checklist_items (
  room_id uuid not null references rooms(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  position int not null default 0,
  primary key (room_id, checklist_item_id)
);

-- ---------- OCCURRENCE CATEGORIES (categorias de ocorrências) ----------
create table occurrence_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- BREAKFAST TABLES (mesas do café da manhã / layout) ----------
create table breakfast_tables (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  shape table_shape not null default 'round',
  seats int not null default 2,
  pos_x numeric not null default 0,
  pos_y numeric not null default 0,
  width numeric not null default 80,
  height numeric not null default 80,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- COMMISSION SETTINGS (valor da comissão por mesa) ----------
create table commission_settings (
  id int primary key default 1,
  value_per_table numeric(10,2) not null default 10.00,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into commission_settings (id, value_per_table) values (1, 10.00);

-- ---------- DAILY ROOM TASKS (tarefas diárias de arrumação/preparação) ----------
create table daily_room_tasks (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  task_type checklist_type not null,
  assigned_to uuid references profiles(id) on delete set null,
  status task_status not null default 'pendente',
  started_at timestamptz,
  finished_at timestamptz,
  released_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (date, room_id, task_type)
);

-- ---------- DAILY ROOM TASK CHECKS (itens marcados) ----------
create table daily_room_task_checks (
  id uuid primary key default uuid_generate_v4(),
  daily_room_task_id uuid not null references daily_room_tasks(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  checked boolean not null default false,
  checked_at timestamptz,
  unique (daily_room_task_id, checklist_item_id)
);

-- ---------- DAILY ROOM TASK OCCURRENCES (ocorrências registradas) ----------
create table daily_room_task_occurrences (
  id uuid primary key default uuid_generate_v4(),
  daily_room_task_id uuid not null references daily_room_tasks(id) on delete cascade,
  occurrence_category_id uuid not null references occurrence_categories(id),
  description text,
  status occurrence_status not null default 'pendente',
  selected_by uuid references profiles(id) on delete set null,
  selected_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- DAILY BREAKFAST (mesas de café por dia) ----------
create table daily_breakfast (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  table_id uuid not null references breakfast_tables(id) on delete cascade,
  guest_count int not null default 0,
  notes text,
  value_per_table_snapshot numeric(10,2) not null default 10.00,
  created_at timestamptz not null default now(),
  unique (date, table_id)
);

-- ---------- DAILY ARRIVALS (chegadas previstas do dia) ----------
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

-- ---------- DAILY DEPARTURES (saídas previstas do dia) ----------
create table daily_departures (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, room_id)
);

-- ---------- MAINTENANCE CATEGORIES (categorias de manutenção preventiva) ----------
-- start_date: data em que a categoria teve (ou terá) sua primeira
-- manutenção; serve de âncora do cronograma para os itens que a seguem
-- (ver maintenance_items.follows_category_start_date). Alterá-la recalcula
-- next_due_date desses itens (função recompute_category_schedule).
create table maintenance_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  position int not null default 0,
  start_date date,
  created_at timestamptz not null default now()
);

-- ---------- MAINTENANCE ITEMS (itens de manutenção preventiva, por categoria) ----------
-- next_due_date/status/selected_by/selected_at guardam o ciclo atual do item;
-- ao concluir, o item volta para 'pendente' com next_due_date empurrada pela
-- periodicidade, e a conclusão fica registrada em maintenance_completions.
-- follows_category_start_date/start_date: por padrão o item segue a data
-- inicial da categoria; se um item teve sua primeira manutenção em outra
-- data, follows_category_start_date fica false e start_date guarda a data
-- própria dele, que passa a ser a âncora do seu cronograma (independente da
-- categoria) — ver função recompute_item_schedule.
create table maintenance_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references maintenance_categories(id) on delete cascade,
  label text not null,
  description text,
  execution_type maintenance_execution_type not null,
  periodicity_days int not null check (periodicity_days > 0),
  next_due_date date not null default current_date,
  status maintenance_item_status not null default 'pendente',
  selected_by uuid references profiles(id) on delete set null,
  selected_at timestamptz,
  active boolean not null default true,
  position int not null default 0,
  follows_category_start_date boolean not null default true,
  start_date date,
  created_at timestamptz not null default now()
);

-- ---------- MAINTENANCE COMPLETIONS (histórico de execuções concluídas) ----------
create table maintenance_completions (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references maintenance_items(id) on delete cascade,
  due_date date not null,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz not null default now(),
  external_technician_name text,
  created_at timestamptz not null default now()
);

-- ---------- MINIBAR ITEMS (catálogo de consumo de frigobar) ----------
create table minibar_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- POOLBAR ITEMS (catálogo do bar da piscina, por categoria) ----------
create table poolbar_items (
  id uuid primary key default uuid_generate_v4(),
  category text,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- ROOM BILLS (conta de bar/frigobar por quarto) ----------
-- Ciclo único por quarto que governa tanto frigobar quanto bar da piscina:
-- aberta -> fechada (camareira bloqueada) -> reaberta (volta a aceitar
-- lançamentos, admin pode editar itens) -> paga (uma conta 'aberta' nova
-- nasce automaticamente). Cada quarto tem no máximo 1 conta não-paga.
create table room_bills (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  status room_bill_status not null default 'aberta',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references profiles(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references profiles(id) on delete set null
);
create unique index room_bills_one_active_per_room on room_bills(room_id) where status <> 'paga';

-- ---------- ROOM BILL MINIBAR ITEMS (lançamentos de frigobar por conta) ----------
-- price_snapshot preserva o preço vigente no momento do lançamento; a
-- quantidade é única por (conta, item) e acumula lançamentos de qualquer
-- camareira/admin enquanto a conta estiver aberta ou reaberta.
create table room_bill_minibar_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references room_bills(id) on delete cascade,
  minibar_item_id uuid not null references minibar_items(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  price_snapshot numeric(10,2) not null,
  updated_at timestamptz not null default now(),
  unique (bill_id, minibar_item_id)
);

-- ---------- ROOM BILL POOLBAR ITEMS (lançamentos do bar da piscina por conta) ----------
create table room_bill_poolbar_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references room_bills(id) on delete cascade,
  poolbar_item_id uuid not null references poolbar_items(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  price_snapshot numeric(10,2) not null,
  updated_at timestamptz not null default now(),
  unique (bill_id, poolbar_item_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table checklist_items enable row level security;
alter table room_checklist_items enable row level security;
alter table occurrence_categories enable row level security;
alter table breakfast_tables enable row level security;
alter table commission_settings enable row level security;
alter table daily_room_tasks enable row level security;
alter table daily_room_task_checks enable row level security;
alter table daily_room_task_occurrences enable row level security;
alter table daily_breakfast enable row level security;
alter table daily_arrivals enable row level security;
alter table daily_departures enable row level security;
alter table maintenance_categories enable row level security;
alter table maintenance_items enable row level security;
alter table maintenance_completions enable row level security;
alter table minibar_items enable row level security;
alter table poolbar_items enable row level security;
alter table room_bills enable row level security;
alter table room_bill_minibar_items enable row level security;
alter table room_bill_poolbar_items enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and active = true
  );
$$ language sql security definer stable;

-- Helper: is the current user a funcionário de manutenção?
create or replace function is_manutencao() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'manutencao' and active = true
  );
$$ language sql security definer stable;

-- profiles: user can read own profile; admin can read/write all
create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_admin_all" on profiles for all
  using (is_admin()) with check (is_admin());
-- funcionário de manutenção precisa ler o nome da camareira que registrou cada
-- ocorrência e o nome de colegas que selecionaram/resolveram outras ocorrências
create policy "profiles_manutencao_select_camareiras" on profiles for select
  using (is_manutencao() and role in ('camareira', 'manutencao'));

-- rooms: everyone authenticated can read; only admin writes
create policy "rooms_select_authenticated" on rooms for select using (auth.uid() is not null);
create policy "rooms_admin_write" on rooms for insert with check (is_admin());
create policy "rooms_admin_update" on rooms for update using (is_admin());
create policy "rooms_admin_delete" on rooms for delete using (is_admin());

-- checklist_items
create policy "checklist_items_select_authenticated" on checklist_items for select using (auth.uid() is not null);
create policy "checklist_items_admin_write" on checklist_items for insert with check (is_admin());
create policy "checklist_items_admin_update" on checklist_items for update using (is_admin());
create policy "checklist_items_admin_delete" on checklist_items for delete using (is_admin());

-- room_checklist_items
create policy "rci_select_authenticated" on room_checklist_items for select using (auth.uid() is not null);
create policy "rci_admin_write" on room_checklist_items for insert with check (is_admin());
create policy "rci_admin_update" on room_checklist_items for update using (is_admin());
create policy "rci_admin_delete" on room_checklist_items for delete using (is_admin());

-- occurrence_categories
create policy "occ_cat_select_authenticated" on occurrence_categories for select using (auth.uid() is not null);
create policy "occ_cat_admin_write" on occurrence_categories for insert with check (is_admin());
create policy "occ_cat_admin_update" on occurrence_categories for update using (is_admin());
create policy "occ_cat_admin_delete" on occurrence_categories for delete using (is_admin());

-- breakfast_tables
create policy "bt_select_authenticated" on breakfast_tables for select using (auth.uid() is not null);
create policy "bt_admin_write" on breakfast_tables for insert with check (is_admin());
create policy "bt_admin_update" on breakfast_tables for update using (is_admin());
create policy "bt_admin_delete" on breakfast_tables for delete using (is_admin());

-- commission_settings
create policy "cs_select_authenticated" on commission_settings for select using (auth.uid() is not null);
create policy "cs_admin_update" on commission_settings for update using (is_admin());

-- daily_room_tasks: admin full; camareira can see her own tasks plus unclaimed ones (to
-- choose from), can claim an unclaimed task, and can update/finish tasks she already owns.
create policy "drt_admin_all" on daily_room_tasks for all using (is_admin()) with check (is_admin());
create policy "drt_camareira_select" on daily_room_tasks for select
  using (assigned_to = auth.uid());
create policy "drt_camareira_select_available" on daily_room_tasks for select
  using (assigned_to is null);
create policy "drt_camareira_update_own" on daily_room_tasks for update
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());
create policy "drt_camareira_claim" on daily_room_tasks for update
  using (assigned_to is null)
  with check (assigned_to = auth.uid());
-- funcionário de manutenção só usa esta tabela para enxergar em qual quarto/dia/camareira
-- se deu cada ocorrência (join a partir de daily_room_task_occurrences); leitura ampla.
create policy "drt_manutencao_select" on daily_room_tasks for select
  using (is_manutencao());

-- daily_room_task_checks: admin full; camareira can read/update checks of her own tasks
create policy "drtc_admin_all" on daily_room_task_checks for all using (is_admin()) with check (is_admin());
create policy "drtc_camareira_select" on daily_room_task_checks for select
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));
create policy "drtc_camareira_update" on daily_room_task_checks for update
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()))
  with check (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));

-- daily_room_task_occurrences: admin full; camareira can insert/select occurrences of her own tasks
create policy "drto_admin_all" on daily_room_task_occurrences for all using (is_admin()) with check (is_admin());
create policy "drto_camareira_select" on daily_room_task_occurrences for select
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));
create policy "drto_camareira_insert" on daily_room_task_occurrences for insert
  with check (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));

-- daily_room_task_occurrences: funcionário de manutenção vê toda ocorrência ainda não
-- resolvida (garante pelo menos hoje/ontem, e mantém as mais antigas até serem
-- resolvidas); some da tela assim que marcada como resolvida.
create policy "drto_manutencao_select" on daily_room_task_occurrences for select
  using (is_manutencao() and status <> 'resolvida');

-- Selecionar/resolver uma ocorrência é feito por funções security definer
-- (abaixo), não por policy de UPDATE: evita depender da combinação de
-- múltiplas policies permissivas de UPDATE na mesma tabela.
create or replace function select_occurrence(occ_id uuid) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update daily_room_task_occurrences
  set status = 'selecionada', selected_by = auth.uid(), selected_at = now()
  where id = occ_id and status = 'pendente';
end;
$$ language plpgsql security definer;

create or replace function resolve_occurrence(occ_id uuid) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update daily_room_task_occurrences
  set status = 'resolvida', resolved_by = auth.uid(), resolved_at = now()
  where id = occ_id and selected_by = auth.uid();
end;
$$ language plpgsql security definer;

-- Marcar/desmarcar um item de checklist é feito por função security definer:
-- colapsa em 1 round trip o que seriam 1 select + até 3 updates sequenciais
-- (check + status da tarefa + started_at), reduzindo o delay percebido pela
-- camareira ao clicar no item.
create or replace function toggle_daily_room_task_check(p_check_id uuid, p_checked boolean)
returns void as $$
declare
  v_task_id uuid;
begin
  select daily_room_task_id into v_task_id
  from daily_room_task_checks
  where id = p_check_id;

  if v_task_id is null then
    raise exception 'check not found';
  end if;

  if not exists (
    select 1 from daily_room_tasks
    where id = v_task_id and assigned_to = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  update daily_room_task_checks
  set checked = p_checked, checked_at = case when p_checked then now() else null end
  where id = p_check_id;

  update daily_room_tasks
  set status = 'em_andamento'
  where id = v_task_id and status = 'pendente';

  update daily_room_tasks
  set started_at = now()
  where id = v_task_id and started_at is null;
end;
$$ language plpgsql security definer;

-- Permite ao admin reordenar itens de checklist (arrumação/troca/preparação
-- chegada) e itens de manutenção preventiva, incluindo inserir um item novo
-- em qualquer posição (primeiro, último ou intermediária). Recebe a lista
-- completa de ids já na ordem final desejada (escopada por type/category_id)
-- e reescreve a coluna position de todos eles em 1 round trip.
create or replace function reorder_checklist_items(p_type checklist_type, p_ordered_ids uuid[])
returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  update checklist_items ci
  set position = x.idx
  from unnest(p_ordered_ids) with ordinality as x(id, idx)
  where ci.id = x.id and ci.type = p_type;
end;
$$ language plpgsql security definer;

create or replace function reorder_maintenance_items(p_category_id uuid, p_ordered_ids uuid[])
returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  update maintenance_items mi
  set position = x.idx
  from unnest(p_ordered_ids) with ordinality as x(id, idx)
  where mi.id = x.id and mi.category_id = p_category_id;
end;
$$ language plpgsql security definer;

-- daily_breakfast: everyone authenticated reads; only admin writes
create policy "db_select_authenticated" on daily_breakfast for select using (auth.uid() is not null);
create policy "db_admin_write" on daily_breakfast for insert with check (is_admin());
create policy "db_admin_update" on daily_breakfast for update using (is_admin());
create policy "db_admin_delete" on daily_breakfast for delete using (is_admin());

-- daily_arrivals: everyone authenticated reads; only admin writes
create policy "da_select_authenticated" on daily_arrivals for select using (auth.uid() is not null);
create policy "da_admin_write" on daily_arrivals for insert with check (is_admin());
create policy "da_admin_update" on daily_arrivals for update using (is_admin());
create policy "da_admin_delete" on daily_arrivals for delete using (is_admin());

-- daily_departures: everyone authenticated reads; only admin writes
create policy "dd_select_authenticated" on daily_departures for select using (auth.uid() is not null);
create policy "dd_admin_write" on daily_departures for insert with check (is_admin());
create policy "dd_admin_update" on daily_departures for update using (is_admin());
create policy "dd_admin_delete" on daily_departures for delete using (is_admin());

-- maintenance_categories / maintenance_items / maintenance_completions:
-- todo autenticado lê (admin e funcionário de manutenção usam essas telas);
-- só admin edita direto. Selecionar/concluir itens é feito por funções
-- security definer abaixo, não por policy de UPDATE (mesmo motivo do fix
-- aplicado às ocorrências: evita a combinação de múltiplas policies de
-- UPDATE permissivas na mesma tabela).
create policy "mc_select_authenticated" on maintenance_categories for select using (auth.uid() is not null);
create policy "mc_admin_write" on maintenance_categories for insert with check (is_admin());
create policy "mc_admin_update" on maintenance_categories for update using (is_admin());
create policy "mc_admin_delete" on maintenance_categories for delete using (is_admin());

create policy "mi_select_authenticated" on maintenance_items for select using (auth.uid() is not null);
create policy "mi_admin_write" on maintenance_items for insert with check (is_admin());
create policy "mi_admin_update" on maintenance_items for update using (is_admin());
create policy "mi_admin_delete" on maintenance_items for delete using (is_admin());

create policy "mcomp_select_authenticated" on maintenance_completions for select using (auth.uid() is not null);

-- Seleciona (reivindica) para si todos os itens pendentes de uma categoria
-- cuja data prevista caia no intervalo informado (o "card" de uma semana
-- específica, corrente ou atrasada).
create or replace function claim_maintenance_category(cat_id uuid, due_from date, due_to date) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update maintenance_items
  set status = 'selecionada', selected_by = auth.uid(), selected_at = now()
  where category_id = cat_id
    and active = true
    and status = 'pendente'
    and next_due_date between due_from and due_to;
end;
$$ language plpgsql security definer;

-- Conclui os itens não técnicos (internos), da categoria e do intervalo de
-- datas informados, selecionados pelo próprio funcionário; registra
-- histórico e agenda o próximo ciclo.
create or replace function complete_maintenance_nao_tecnico(cat_id uuid, due_from date, due_to date) returns void as $$
declare
  r record;
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  for r in
    select id, next_due_date, periodicity_days
    from maintenance_items
    where category_id = cat_id
      and execution_type = 'nao_tecnico'
      and status = 'selecionada'
      and selected_by = auth.uid()
      and next_due_date between due_from and due_to
  loop
    insert into maintenance_completions (item_id, due_date, completed_by)
    values (r.id, r.next_due_date, auth.uid());

    update maintenance_items
    set status = 'pendente', selected_by = null, selected_at = null,
        next_due_date = current_date + r.periodicity_days
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

-- Conclui os itens técnicos (externos), da categoria e do intervalo de datas
-- informados, selecionados pelo próprio funcionário; o funcionário registra
-- apenas o nome do técnico externo e fica registrado como quem supervisionou.
create or replace function complete_maintenance_tecnico(cat_id uuid, due_from date, due_to date, external_name text) returns void as $$
declare
  r record;
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;
  if external_name is null or btrim(external_name) = '' then
    raise exception 'external technician name is required';
  end if;

  for r in
    select id, next_due_date, periodicity_days
    from maintenance_items
    where category_id = cat_id
      and execution_type = 'tecnico'
      and status = 'selecionada'
      and selected_by = auth.uid()
      and next_due_date between due_from and due_to
  loop
    insert into maintenance_completions (item_id, due_date, completed_by, external_technician_name)
    values (r.id, r.next_due_date, auth.uid(), btrim(external_name));

    update maintenance_items
    set status = 'pendente', selected_by = null, selected_at = null,
        next_due_date = current_date + r.periodicity_days
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

-- Dada uma data de início e uma periodicidade em dias, calcula a próxima
-- data prevista: a própria data de início, se ainda não chegou, ou a
-- primeira ocorrência do ciclo (início + N*periodicidade) a partir de hoje.
create or replace function compute_next_due_date(p_start_date date, p_periodicity_days int)
returns date as $$
  select case
    when p_start_date >= current_date then p_start_date
    else p_start_date + (
      ceil((current_date - p_start_date)::numeric / p_periodicity_days) * p_periodicity_days
    )::int
  end;
$$ language sql stable;

-- Recalcula next_due_date de todos os itens da categoria que seguem a data
-- inicial dela (chamada sempre que o admin define/altera essa data).
create or replace function recompute_category_schedule(p_category_id uuid)
returns void as $$
declare
  v_start_date date;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select start_date into v_start_date from maintenance_categories where id = p_category_id;
  if v_start_date is null then
    return;
  end if;

  update maintenance_items
  set next_due_date = compute_next_due_date(v_start_date, periodicity_days)
  where category_id = p_category_id and follows_category_start_date = true;
end;
$$ language plpgsql security definer;

-- Recalcula next_due_date de um único item, a partir da data inicial da
-- categoria (se ele a segue) ou da sua própria data inicial (se não segue).
create or replace function recompute_item_schedule(p_item_id uuid)
returns void as $$
declare
  v_follows boolean;
  v_own_start date;
  v_cat_start date;
  v_periodicity int;
  v_anchor date;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select mi.follows_category_start_date, mi.start_date, mi.periodicity_days, mc.start_date
    into v_follows, v_own_start, v_periodicity, v_cat_start
  from maintenance_items mi
  join maintenance_categories mc on mc.id = mi.category_id
  where mi.id = p_item_id;

  v_anchor := case when v_follows then v_cat_start else v_own_start end;
  if v_anchor is null then
    return;
  end if;

  update maintenance_items set next_due_date = compute_next_due_date(v_anchor, v_periodicity) where id = p_item_id;
end;
$$ language plpgsql security definer;

-- minibar_items: todo autenticado lê (camareira usa a lista); só admin edita
create policy "mbi_select_authenticated" on minibar_items for select using (auth.uid() is not null);
create policy "mbi_admin_write" on minibar_items for insert with check (is_admin());
create policy "mbi_admin_update" on minibar_items for update using (is_admin());
create policy "mbi_admin_delete" on minibar_items for delete using (is_admin());

-- poolbar_items: todo autenticado lê; só admin edita
create policy "pbi_select_authenticated" on poolbar_items for select using (auth.uid() is not null);
create policy "pbi_admin_write" on poolbar_items for insert with check (is_admin());
create policy "pbi_admin_update" on poolbar_items for update using (is_admin());
create policy "pbi_admin_delete" on poolbar_items for delete using (is_admin());

-- room_bills: todo autenticado lê (camareira precisa saber se a conta está
-- fechada/reaberta); só admin muda o status (fechar/reabrir/pagar).
create policy "rb_select_authenticated" on room_bills for select using (auth.uid() is not null);
create policy "rb_admin_all" on room_bills for all using (is_admin()) with check (is_admin());

-- room_bill_minibar_items: admin sempre pode; camareira só quando a conta
-- corrente do quarto está aberta ou reaberta (bloqueada quando fechada).
create policy "rbmi_select_authenticated" on room_bill_minibar_items for select using (auth.uid() is not null);
create policy "rbmi_admin_all" on room_bill_minibar_items for all using (is_admin()) with check (is_admin());
create policy "rbmi_camareira_insert" on room_bill_minibar_items for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'camareira' and active = true)
    and exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta'))
  );
create policy "rbmi_camareira_update" on room_bill_minibar_items for update
  using (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')))
  with check (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')));

-- room_bill_poolbar_items: mesmo padrão do frigobar
create policy "rbpi_select_authenticated" on room_bill_poolbar_items for select using (auth.uid() is not null);
create policy "rbpi_admin_all" on room_bill_poolbar_items for all using (is_admin()) with check (is_admin());
create policy "rbpi_camareira_insert" on room_bill_poolbar_items for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'camareira' and active = true)
    and exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta'))
  );
create policy "rbpi_camareira_update" on room_bill_poolbar_items for update
  using (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')))
  with check (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')));

insert into minibar_items (name, price, position) values
  ('Água sem gás', 5.00, 1),
  ('Água com gás', 6.00, 2),
  ('Refrigerante', 10.00, 3),
  ('Cerveja', 12.00, 4),
  ('Café expresso', 7.00, 5);

insert into poolbar_items (category, name, price, position) values
  ('Petiscos', 'Bolinho de Bacalhau (10un)', 60.00, 1),
  ('Petiscos', 'Pastel Camarão (6un)', 55.00, 2),
  ('Petiscos', 'Pastel de Queijo (6un)', 50.00, 3),
  ('Petiscos', 'Caldo de Camarão', 45.00, 4),
  ('Petiscos', 'Camarão Alho Óleo c/Macaxeira', 90.00, 5),
  ('Petiscos', 'Macaxeira frita', 30.00, 6),
  ('Petiscos', 'Camarão frito', 60.00, 7),
  ('Petiscos', 'Filé Camarão c/Macaxeira', 110.00, 8),
  ('Petiscos', 'Filé Mignon trinchado c/Macaxeira', 85.00, 9),
  ('Petiscos', 'Salada trivial (Folhas/Tomate/Cebola/Ovos/Palmito)', 60.00, 10),
  ('Petiscos', 'Americano (Pão forma/Presunto/Queijo/Ovo/Salada)', 30.00, 11),
  ('Bebidas', 'Caipirinha', 25.00, 12),
  ('Bebidas', 'Caipiroska Smirnoff', 35.00, 13),
  ('Bebidas', 'Caipiroska Absolut', 45.00, 14),
  ('Bebidas', 'Caipifruta Cachaça', 30.00, 15),
  ('Bebidas', 'Caipifruta Smirnoff', 40.00, 16),
  ('Bebidas', 'Gim Tônica à moda da casa (Tanqueray)', 50.00, 17),
  ('Bebidas', 'Campari', 15.00, 18),
  ('Bebidas', 'Água de Coco', 8.00, 19);

-- Não há seed de room_bills aqui porque rooms só é populado depois, por
-- seed.sql: a conta 'aberta' de cada quarto é criada sob demanda pelo
-- próprio app (Server Action) na primeira vez que é necessária.

-- Garante (e retorna) a conta não-paga corrente de um quarto, criando-a se
-- ainda não existir. Só admin pode inserir em room_bills via RLS comum, mas
-- qualquer usuário autenticado (inclusive camareira, ao lançar consumo pela
-- primeira vez num quarto novo) precisa conseguir garantir essa conta —
-- daí a função security definer, no mesmo padrão de select_occurrence etc.
create or replace function ensure_room_bill(p_room_id uuid)
returns room_bills as $$
declare
  v_bill room_bills;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_bill from room_bills where room_id = p_room_id and status <> 'paga' limit 1;
  if v_bill.id is not null then
    return v_bill;
  end if;

  insert into room_bills (room_id, status) values (p_room_id, 'aberta') returning * into v_bill;
  return v_bill;
end;
$$ language plpgsql security definer;

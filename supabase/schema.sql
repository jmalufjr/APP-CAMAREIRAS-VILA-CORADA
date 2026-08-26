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
create table maintenance_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- MAINTENANCE ITEMS (itens de manutenção preventiva, por categoria) ----------
-- next_due_date/status/selected_by/selected_at guardam o ciclo atual do item;
-- ao concluir, o item volta para 'pendente' com next_due_date empurrada pela
-- periodicidade, e a conclusão fica registrada em maintenance_completions.
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

-- Seleciona (reivindica) para si todos os itens pendentes e já vencidos
-- (hoje/amanhã ou atrasados) de uma categoria.
create or replace function claim_maintenance_category(cat_id uuid) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update maintenance_items
  set status = 'selecionada', selected_by = auth.uid(), selected_at = now()
  where category_id = cat_id
    and active = true
    and status = 'pendente'
    and next_due_date <= (current_date + 1);
end;
$$ language plpgsql security definer;

-- Conclui os itens não técnicos (internos) selecionados pelo próprio
-- funcionário para a categoria; registra histórico e agenda o próximo ciclo.
create or replace function complete_maintenance_nao_tecnico(cat_id uuid) returns void as $$
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

-- Conclui os itens técnicos (externos) selecionados pelo próprio funcionário
-- para a categoria; o funcionário registra apenas o nome do técnico externo
-- e fica registrado como quem supervisionou.
create or replace function complete_maintenance_tecnico(cat_id uuid, external_name text) returns void as $$
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

-- ===== 25-modelo-simplificado-cadastro.sql =====
-- Modelo contabil simplificado (PRD_modelo_simplificado.md), etapa 1:
-- cadastro novo, SO tabelas novas (nada do modelo velho e alterado).

-- Centros de resultado (4 fixos)
create table if not exists result_centers (
  code text primary key check (code in ('hospedagem','bar','cafe','frigobar')),
  name text not null,
  position int not null default 0
);
insert into result_centers (code, name, position) values
  ('hospedagem','Hospedagem',1),('bar','Bar',2),('cafe','Café da manhã',3),('frigobar','Frigobar',4)
on conflict (code) do nothing;

-- Categorias de despesa. rule: como o rateio entre centros e feito.
--  fixo         = percentuais em expense_category_centers
--  alimentos    = ingrediente segue o rateio dele; demais itens 100% cafe
--  bebidas      = bar x frigobar calculado no mes pelas quantidades vendidas
--  nao_alocavel = impostos (fora dos centros)
create table if not exists expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  consumption_days int not null default 1 check (consumption_days >= 1),
  rule text not null default 'fixo' check (rule in ('fixo','alimentos','bebidas','nao_alocavel')),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists expense_categories_name_uq on expense_categories (lower(name));

create table if not exists expense_category_centers (
  category_id uuid not null references expense_categories(id) on delete cascade,
  center_code text not null references result_centers(code),
  pct numeric(6,2) not null check (pct > 0 and pct <= 100),
  primary key (category_id, center_code)
);

-- Ingredientes de produtos de bar (alimentos): rateio bar x cafe.
create table if not exists ingredients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  bar_pct numeric(6,2) not null default 50 check (bar_pct >= 0 and bar_pct <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists ingredients_name_uq on ingredients (lower(name));

-- Configuracoes (linha unica)
create table if not exists expense_settings (
  id boolean primary key default true check (id),
  asset_threshold numeric(12,2) not null default 1200,
  asset_min_life_months int not null default 12,
  late_window_days int not null default 30,
  start_date date not null default date '2026-11-01'
);
insert into expense_settings (id) values (true) on conflict (id) do nothing;

-- Compras/despesas (modelo novo). Data da compra = data do pagamento.
create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text,
  document_number text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_method text,
  receipt_storage_path text,
  notes text,
  source text not null default 'manual' check (source in ('manual','whatsapp','recorrente')),
  status text not null default 'registrada' check (status in ('registrada','pendente_aprovacao','cancelada')),
  posted_after_close boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists purchases_date_idx on purchases (date);

create table if not exists purchase_lines (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  category_id uuid references expense_categories(id),
  ingredient_id uuid references ingredients(id) on delete set null,
  fixed_asset_id uuid references fixed_assets(id) on delete set null,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  -- true = ativo permanente (nao vai ao resultado)
  is_asset boolean not null default false,
  useful_life_months int check (useful_life_months is null or useful_life_months > 0),
  created_at timestamptz not null default now()
);
create index if not exists purchase_lines_purchase_idx on purchase_lines (purchase_id);

-- Estado da compra conforme o fechamento do mes: ate 30 dias depois do
-- fim do mes entra sozinha (com marca); depois fica pendente de aprovacao.
create or replace function purchases_set_status() returns trigger as $$
declare
  month_end date;
  win int;
begin
  if tg_op = 'INSERT' and new.status = 'registrada' then
    month_end := (date_trunc('month', new.date) + interval '1 month - 1 day')::date;
    select late_window_days into win from expense_settings where id;
    if current_date > month_end then
      new.posted_after_close := true;
      if current_date > month_end + coalesce(win, 30) then
        new.status := 'pendente_aprovacao';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists purchases_status_trg on purchases;
create trigger purchases_status_trg before insert on purchases
  for each row execute function purchases_set_status();

-- Itens recorrentes (salarios, honorarios etc.)
create table if not exists recurring_expenses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid not null references expense_categories(id),
  amount numeric(12,2) not null check (amount >= 0),
  day_of_month int not null default 5 check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_generated_month date,
  created_at timestamptz not null default now()
);

-- RLS: admin e gerente operacional
alter table result_centers enable row level security;
alter table expense_categories enable row level security;
alter table expense_category_centers enable row level security;
alter table ingredients enable row level security;
alter table expense_settings enable row level security;
alter table purchases enable row level security;
alter table purchase_lines enable row level security;
alter table recurring_expenses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['result_centers','expense_categories','expense_category_centers','ingredients',
    'expense_settings','purchases','purchase_lines','recurring_expenses'] loop
    execute format('drop policy if exists %I on %I', t || '_rw', t);
    execute format('create policy %I on %I for all using (is_admin_or_gerente()) with check (is_admin_or_gerente())', t || '_rw', t);
  end loop;
end $$;

-- Categorias iniciais
insert into expense_categories (name, consumption_days, rule, position) values
  ('Alimentos',1,'alimentos',1),
  ('Bebidas quentes',1,'fixo',2),
  ('Demais bebidas',1,'bebidas',3),
  ('Materiais de limpeza',30,'fixo',4),
  ('Amenities',30,'fixo',5),
  ('Materiais de piscina',30,'fixo',6),
  ('Materiais de lavanderia',30,'fixo',7),
  ('Materiais de jardinagem',30,'fixo',8),
  ('Despesas de consumo',1,'fixo',9),
  ('Despesas de pessoal administrativo',1,'fixo',10),
  ('Despesas de marketing',1,'fixo',11),
  ('Materiais de escritório',30,'fixo',12),
  ('Despesas de pessoal operacional',1,'fixo',13),
  ('Despesas de reforma e manutenção',1,'fixo',14),
  ('Impostos',1,'nao_alocavel',15)
on conflict do nothing;

insert into expense_category_centers (category_id, center_code, pct)
select c.id, v.center, v.pct from expense_categories c
join (values
  ('Bebidas quentes','bar',100),
  ('Despesas de consumo','hospedagem',40),
  ('Despesas de consumo','cafe',30),
  ('Despesas de consumo','bar',30)
) as v(name, center, pct) on lower(c.name) = lower(v.name)
on conflict do nothing;

-- Demais categorias de regra fixa: 100% hospedagem
insert into expense_category_centers (category_id, center_code, pct)
select c.id, 'hospedagem', 100 from expense_categories c
where c.rule = 'fixo'
  and not exists (select 1 from expense_category_centers x where x.category_id = c.id)
on conflict do nothing;
-- ===== 26-resultado-mensal.sql =====
-- Resultado mensal (PRD_modelo_simplificado.md): receitas datadas.

-- 1) Frigobar: cada lançamento (mudança de quantidade) fica datado.
--    O gatilho vale para qualquer caminho que grave o consumo.
create table if not exists minibar_launches (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references room_bills(id) on delete cascade,
  minibar_item_id uuid not null references minibar_items(id) on delete cascade,
  delta int not null check (delta <> 0),
  unit_price numeric(10,2) not null,
  launched_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default now()
);
create index if not exists minibar_launches_date_idx on minibar_launches (launched_on);
create index if not exists minibar_launches_bill_idx on minibar_launches (bill_id);

create or replace function log_minibar_launch() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d int;
begin
  if tg_op = 'INSERT' then
    d := new.quantity;
  else
    d := new.quantity - old.quantity;
  end if;
  if d <> 0 then
    insert into minibar_launches (bill_id, minibar_item_id, delta, unit_price)
    values (new.bill_id, new.minibar_item_id, d, new.price_snapshot);
  end if;
  return new;
end;
$$;

drop trigger if exists room_bill_minibar_items_launch on room_bill_minibar_items;
create trigger room_bill_minibar_items_launch
  after insert or update of quantity on room_bill_minibar_items
  for each row execute function log_minibar_launch();

-- Saldos já existentes entram com a data de hoje (não há data anterior).
insert into minibar_launches (bill_id, minibar_item_id, delta, unit_price)
select bill_id, minibar_item_id, quantity, price_snapshot
from room_bill_minibar_items
where quantity > 0
  and not exists (select 1 from minibar_launches l where l.bill_id = room_bill_minibar_items.bill_id);

-- 2) Receita de bar/frigobar que chegou depois da janela de 30 dias: o admin decide.
create table if not exists revenue_approvals (
  bill_id uuid not null references room_bills(id) on delete cascade,
  month date not null,
  decision text not null check (decision in ('aprovada','cancelada')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  primary key (bill_id, month)
);

-- 3) Hospedagem (Stays): valores congelados 30 dias após o fim do mês.
create table if not exists lodging_month_freeze (
  month date primary key,
  gross numeric(14,2) not null,
  commission numeric(14,2) not null,
  frozen_at timestamptz not null default now(),
  approved_by uuid references profiles(id) on delete set null
);

alter table minibar_launches enable row level security;
alter table revenue_approvals enable row level security;
alter table lodging_month_freeze enable row level security;

drop policy if exists minibar_launches_select on minibar_launches;
create policy minibar_launches_select on minibar_launches for select using (is_admin_or_gerente());
drop policy if exists revenue_approvals_rw on revenue_approvals;
create policy revenue_approvals_rw on revenue_approvals for all using (is_admin()) with check (is_admin());
drop policy if exists revenue_approvals_select on revenue_approvals;
create policy revenue_approvals_select on revenue_approvals for select using (is_admin_or_gerente());
drop policy if exists lodging_month_freeze_select on lodging_month_freeze;
create policy lodging_month_freeze_select on lodging_month_freeze for select using (is_admin_or_gerente());
drop policy if exists lodging_month_freeze_admin on lodging_month_freeze;
create policy lodging_month_freeze_admin on lodging_month_freeze for all using (is_admin()) with check (is_admin());
-- ===== 27-caixa-de-conferencia.sql =====
-- Caixa de conferencia de compras (PRD_modelo_simplificado.md): notas que
-- chegam do WhatsApp (exportacao da conversa ou, depois, numero oficial)
-- esperam aqui a conferencia do financeiro antes de virar compra.
create table if not exists purchase_inbox (
  id uuid primary key default uuid_generate_v4(),
  source text not null default 'whatsapp_export' check (source in ('whatsapp_export','whatsapp_oficial')),
  -- Impede importar duas vezes a mesma mensagem (exportacoes se sobrepoem).
  dedupe_key text not null unique,
  sender text,
  message_date date not null,
  message_time text,
  note_text text,
  image_storage_path text,
  ai_status text not null default 'pendente' check (ai_status in ('pendente','lida','erro')),
  ai_error text,
  ai_data jsonb,
  status text not null default 'aguardando' check (status in ('aguardando','lancada','descartada')),
  purchase_id uuid references purchases(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists purchase_inbox_status_idx on purchase_inbox (status, message_date);

alter table purchase_inbox enable row level security;
drop policy if exists purchase_inbox_rw on purchase_inbox;
create policy purchase_inbox_rw on purchase_inbox for all using (is_admin_or_gerente()) with check (is_admin_or_gerente());
-- ===== 28-corte-custo-no-consumo.sql =====
-- Corte do modelo antigo (PRD_modelo_simplificado.md): o consumo de bar e
-- frigobar deixa de lancar custo, e a conta da suite deixa de lancar receita
-- no livro de partidas dobradas. O resultado mensal agora e calculado direto
-- das compras, comandas, frigobar (datado) e Stays; o livro antigo fica so
-- como historico. Os dois gatilhos continuam existindo, mas nao fazem mais nada.

create or replace function post_inventory_movement_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Modelo simplificado: sem custo no consumo.
  return new;
end;
$$;

create or replace function post_room_bill_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Modelo simplificado: a receita vem das comandas e do frigobar datados.
  return new;
end;
$$;
-- ===== 30-ficha-tecnica-bar.sql =====
-- Ficha tecnica do bar (modelo simplificado): ingredientes de cada petisco/drink.
-- quantity = quanto do ingrediente entra em UMA unidade vendida (qualquer
-- medida, desde que a mesma para aquele ingrediente em todos os produtos);
-- serve para dividir o custo mensal do ingrediente entre os produtos.
create table if not exists bar_product_ingredients (
  poolbar_item_id uuid not null references poolbar_items(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  primary key (poolbar_item_id, ingredient_id)
);

alter table bar_product_ingredients enable row level security;
drop policy if exists bar_product_ingredients_rw on bar_product_ingredients;
create policy bar_product_ingredients_rw on bar_product_ingredients for all
  using (is_admin_or_gerente()) with check (is_admin_or_gerente());

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

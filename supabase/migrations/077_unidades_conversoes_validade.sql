-- Cadastro de produtos (PRD 5.1) — unidades/conversões e validade por lote.
-- Decisões do proprietário (16/10/2026): conversões valem de verdade em
-- compras e fichas técnicas; validade por lote com alerta.
--
-- Princípio: quantity/unit_cost de expense_items e amount_per_portion
-- das fichas continuam SEMPRE na unidade-base do item (todo leitor
-- existente segue valendo). O que o usuário digitou (24 garrafas a R$18)
-- fica em colunas informativas à parte.

-- "1 garrafa = 0,75 (unidade-base do item)".
create table inventory_item_unit_conversions (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  unit_name text not null,
  factor numeric(14,6) not null check (factor > 0),
  created_at timestamptz not null default now()
);
create unique index inventory_item_unit_conversions_uq on inventory_item_unit_conversions (inventory_item_id, lower(unit_name));

alter table inventory_item_unit_conversions enable row level security;
create policy "unit_conv_select_authenticated" on inventory_item_unit_conversions for select using (auth.uid() is not null);
create policy "unit_conv_admin_write" on inventory_item_unit_conversions for all using (is_admin()) with check (is_admin());

-- Custo por unidade-base pode ter muitas casas (ex.: R$0,024/ml).
alter table expense_items alter column unit_cost type numeric(14,6);
alter table expense_items
  add column purchase_quantity numeric(12,3),
  add column purchase_unit text,
  add column purchase_unit_cost numeric(14,6),
  add column expiry_date date;

-- Unidade em que a quantidade da ficha foi digitada (só exibição; o
-- valor guardado, amount_per_portion, é sempre na unidade-base).
alter table inventory_item_recipes add column display_unit text;

-- Validade: prazo do produto em dias (null = não se aplica) e quantos
-- dias antes do vencimento o sistema avisa.
alter table inventory_items
  add column shelf_life_days int check (shelf_life_days is null or shelf_life_days > 0),
  add column expiry_alert_days int not null default 7 check (expiry_alert_days >= 0);

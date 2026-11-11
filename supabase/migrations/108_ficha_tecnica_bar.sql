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

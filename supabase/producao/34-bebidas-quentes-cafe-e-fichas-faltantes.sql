-- 34: fichas que faltavam (nomes da producao) + bebidas quentes + cafe expresso.
-- Pode ser rodado de novo sem duplicar.

-- Estrutura (migration 110)
-- Categorias que aceitam "ingrediente de produto do bar": alimentos, demais bebidas e
-- bebidas quentes (destilados e vinhos, 100% bar, tambem usados em drinks).
alter table expense_categories add column if not exists allows_ingredient boolean not null default false;
update expense_categories set allows_ingredient = true
where rule in ('alimentos','bebidas') or lower(name) = 'bebidas quentes';

-- Como o gasto de um ingrediente de alimento se divide:
--  bar_cafe      = percentual do bar, resto cafe da manha (padrao)
--  bar_frigobar  = bar x frigobar pelas vendas do mes (ex.: cafe expresso)
alter table ingredients add column if not exists split_mode text not null default 'bar_cafe'
  check (split_mode in ('bar_cafe','bar_frigobar'));

-- Ingredientes novos
insert into ingredients (name, bar_pct, split_mode) values
  ('Cerveja lata (un)', 100, 'bar_cafe'),
  ('Cerveja Heineken longneck (un)', 100, 'bar_cafe'),
  ('Polpa de fruta (g)', 100, 'bar_cafe'),
  ('Café em pó (g)', 100, 'bar_frigobar')
on conflict do nothing;
update ingredients set split_mode = 'bar_frigobar' where name = 'Café em pó (g)';

-- Fichas
insert into bar_product_ingredients (poolbar_item_id, ingredient_id, quantity)
select p.id, i.id, v.qty
from (values
  ('Cerveja Lata', 'Cerveja lata (un)', 1),
  ('Cerveja Longneck%', 'Cerveja Heineken longneck (un)', 1),
  ('Gin T_nica%Tanqueray%', 'Gim Tanqueray (ml)', 50),
  ('Gin T_nica%Tanqueray%', 'Água tônica (ml)', 150),
  ('Gin T_nica%Tanqueray%', 'Limão (un)', 0.25),
  ('Gin T_nica%Tanqueray%', 'Gelo (g)', 150),
  ('Sucos de frutas%', 'Polpa de fruta (g)', 100),
  ('Sucos de frutas%', 'Açúcar (g)', 20),
  ('Sucos de frutas%', 'Gelo (g)', 100),
  ('Taxa de rolha%', 'Gelo (g)', 1000),
  ('Café expresso', 'Café em pó (g)', 8)
) as v(product, ingredient, qty)
join poolbar_items p on lower(p.name) like lower(v.product)
join ingredients i on lower(i.name) = lower(v.ingredient)
on conflict (poolbar_item_id, ingredient_id) do nothing;

-- Conferencia: produtos ainda sem ficha (nao deve sobrar nenhum)
select p.category, p.name
from poolbar_items p
where not exists (select 1 from bar_product_ingredients b where b.poolbar_item_id = p.id)
order by p.category, p.name;

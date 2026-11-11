-- Fichas tecnicas iniciais do cardapio do bar (ingredientes e quantidades de referencia
-- de receitas tradicionais; ajuste no app). Quantidades POR UNIDADE VENDIDA.
-- Pode ser rodado de novo sem duplicar nem sobrescrever ajustes ja feitos.

-- 1) Ingredientes (nome com a unidade de medida; % do gasto que vai ao Bar, o resto ao Cafe)
insert into ingredients (name, bar_pct) values
  -- bebidas e misturas (so do bar)
  ('Cachaça (ml)', 100), ('Vodka Smirnoff (ml)', 100), ('Vodka Absolut (ml)', 100),
  ('Gim Tanqueray (ml)', 100), ('Campari (ml)', 100), ('Água tônica (ml)', 100),
  ('Cerveja (un)', 100), ('Refrigerante (un)', 100), ('Água sem gás (un)', 100),
  ('Água com gás (un)', 100), ('Água de coco (un)', 100),
  -- alimentos so do bar
  ('Gelo (g)', 100), ('Fruta para caipifruta (g)', 100), ('Bacalhau (g)', 100),
  ('Camarão (g)', 100), ('Macaxeira (g)', 100), ('Filé mignon (g)', 100),
  ('Pimentão (g)', 100), ('Farinha de rosca (g)', 100), ('Pepino (g)', 100),
  ('Óleo de fritura (ml)', 100), ('Batata (g)', 100),
  -- alimentos usados tambem no cafe da manha (divisao inicial; ajuste)
  ('Limão (un)', 80), ('Açúcar (g)', 50), ('Ovo (un)', 50), ('Cebola (g)', 60),
  ('Cheiro-verde (g)', 70), ('Alho (g)', 70), ('Tomate (g)', 50), ('Azeite (ml)', 70),
  ('Farinha de trigo (g)', 50), ('Queijo muçarela (g)', 50), ('Presunto (g)', 50),
  ('Pão francês (un)', 50), ('Alface (g)', 50)
on conflict do nothing;

-- 2) Fichas: produto do cardapio (pelo nome) x ingrediente x quantidade por unidade vendida
insert into bar_product_ingredients (poolbar_item_id, ingredient_id, quantity)
select p.id, i.id, v.qty
from (values
  -- Bebidas
  ('Caipirinha', 'Cachaça (ml)', 50), ('Caipirinha', 'Limão (un)', 1), ('Caipirinha', 'Açúcar (g)', 30), ('Caipirinha', 'Gelo (g)', 150),
  ('Caipifruta Cachaça', 'Cachaça (ml)', 50), ('Caipifruta Cachaça', 'Fruta para caipifruta (g)', 100), ('Caipifruta Cachaça', 'Açúcar (g)', 30), ('Caipifruta Cachaça', 'Gelo (g)', 150),
  ('Caipifruta Smirnoff', 'Vodka Smirnoff (ml)', 50), ('Caipifruta Smirnoff', 'Fruta para caipifruta (g)', 100), ('Caipifruta Smirnoff', 'Açúcar (g)', 30), ('Caipifruta Smirnoff', 'Gelo (g)', 150),
  ('Caipiroska Smirnoff', 'Vodka Smirnoff (ml)', 50), ('Caipiroska Smirnoff', 'Limão (un)', 1), ('Caipiroska Smirnoff', 'Açúcar (g)', 30), ('Caipiroska Smirnoff', 'Gelo (g)', 150),
  ('Caipiroska Absolut', 'Vodka Absolut (ml)', 50), ('Caipiroska Absolut', 'Limão (un)', 1), ('Caipiroska Absolut', 'Açúcar (g)', 30), ('Caipiroska Absolut', 'Gelo (g)', 150),
  ('Gim Tônica à moda da casa (Tanqueray)', 'Gim Tanqueray (ml)', 50), ('Gim Tônica à moda da casa (Tanqueray)', 'Água tônica (ml)', 150), ('Gim Tônica à moda da casa (Tanqueray)', 'Limão (un)', 0.25), ('Gim Tônica à moda da casa (Tanqueray)', 'Gelo (g)', 150),
  ('Campari', 'Campari (ml)', 50), ('Campari', 'Gelo (g)', 100),
  ('Cerveja', 'Cerveja (un)', 1), ('Refrigerante', 'Refrigerante (un)', 1),
  ('Água sem gás', 'Água sem gás (un)', 1), ('Água com gás', 'Água com gás (un)', 1), ('Água de Coco', 'Água de coco (un)', 1),
  -- Petiscos
  ('Bolinho de Bacalhau (10un)', 'Bacalhau (g)', 150), ('Bolinho de Bacalhau (10un)', 'Batata (g)', 150), ('Bolinho de Bacalhau (10un)', 'Ovo (un)', 0.6), ('Bolinho de Bacalhau (10un)', 'Cebola (g)', 30), ('Bolinho de Bacalhau (10un)', 'Cheiro-verde (g)', 5), ('Bolinho de Bacalhau (10un)', 'Óleo de fritura (ml)', 150),
  ('Caldo de Camarão', 'Camarão (g)', 100), ('Caldo de Camarão', 'Macaxeira (g)', 100), ('Caldo de Camarão', 'Cebola (g)', 20), ('Caldo de Camarão', 'Tomate (g)', 30), ('Caldo de Camarão', 'Alho (g)', 3), ('Caldo de Camarão', 'Limão (un)', 0.2), ('Caldo de Camarão', 'Cheiro-verde (g)', 5), ('Caldo de Camarão', 'Azeite (ml)', 10),
  ('Camarão frito', 'Camarão (g)', 200), ('Camarão frito', 'Óleo de fritura (ml)', 150), ('Camarão frito', 'Limão (un)', 0.25),
  ('Camarão Alho Óleo c/Macaxeira', 'Camarão (g)', 250), ('Camarão Alho Óleo c/Macaxeira', 'Alho (g)', 12), ('Camarão Alho Óleo c/Macaxeira', 'Azeite (ml)', 30), ('Camarão Alho Óleo c/Macaxeira', 'Macaxeira (g)', 250), ('Camarão Alho Óleo c/Macaxeira', 'Óleo de fritura (ml)', 150), ('Camarão Alho Óleo c/Macaxeira', 'Cheiro-verde (g)', 5), ('Camarão Alho Óleo c/Macaxeira', 'Limão (un)', 0.25),
  ('Filé Camarão c/Macaxeira', 'Camarão (g)', 300), ('Filé Camarão c/Macaxeira', 'Macaxeira (g)', 250), ('Filé Camarão c/Macaxeira', 'Farinha de trigo (g)', 30), ('Filé Camarão c/Macaxeira', 'Ovo (un)', 0.5), ('Filé Camarão c/Macaxeira', 'Farinha de rosca (g)', 40), ('Filé Camarão c/Macaxeira', 'Óleo de fritura (ml)', 250), ('Filé Camarão c/Macaxeira', 'Limão (un)', 0.25),
  ('Filé Mignon trinchado c/Macaxeira', 'Filé mignon (g)', 120), ('Filé Mignon trinchado c/Macaxeira', 'Cebola (g)', 40), ('Filé Mignon trinchado c/Macaxeira', 'Pimentão (g)', 30), ('Filé Mignon trinchado c/Macaxeira', 'Alho (g)', 3), ('Filé Mignon trinchado c/Macaxeira', 'Macaxeira (g)', 250), ('Filé Mignon trinchado c/Macaxeira', 'Óleo de fritura (ml)', 165), ('Filé Mignon trinchado c/Macaxeira', 'Cheiro-verde (g)', 5),
  ('Macaxeira frita', 'Macaxeira (g)', 250), ('Macaxeira frita', 'Óleo de fritura (ml)', 150),
  ('Pastel Camarão (6un)', 'Farinha de trigo (g)', 90), ('Pastel Camarão (6un)', 'Ovo (un)', 0.4), ('Pastel Camarão (6un)', 'Camarão (g)', 90), ('Pastel Camarão (6un)', 'Cebola (g)', 15), ('Pastel Camarão (6un)', 'Óleo de fritura (ml)', 150),
  ('Pastel de Queijo (6un)', 'Farinha de trigo (g)', 90), ('Pastel de Queijo (6un)', 'Ovo (un)', 0.4), ('Pastel de Queijo (6un)', 'Queijo muçarela (g)', 120), ('Pastel de Queijo (6un)', 'Óleo de fritura (ml)', 150),
  ('Salada trivial', 'Alface (g)', 150), ('Salada trivial', 'Tomate (g)', 150), ('Salada trivial', 'Cebola (g)', 40), ('Salada trivial', 'Pepino (g)', 80), ('Salada trivial', 'Azeite (ml)', 15), ('Salada trivial', 'Limão (un)', 0.25),
  ('Americano', 'Pão francês (un)', 1), ('Americano', 'Presunto (g)', 30), ('Americano', 'Queijo muçarela (g)', 40), ('Americano', 'Ovo (un)', 1), ('Americano', 'Alface (g)', 10), ('Americano', 'Tomate (g)', 40), ('Americano', 'Azeite (ml)', 5)
) as v(product, ingredient, qty)
join poolbar_items p on lower(p.name) = lower(v.product)
join ingredients i on lower(i.name) = lower(v.ingredient)
on conflict (poolbar_item_id, ingredient_id) do nothing;

-- Conferencia: quantos ingredientes ficaram em cada produto
select p.name, count(b.ingredient_id) as ingredientes
from poolbar_items p
left join bar_product_ingredients b on b.poolbar_item_id = p.id
group by p.category, p.name
order by p.category, p.name;

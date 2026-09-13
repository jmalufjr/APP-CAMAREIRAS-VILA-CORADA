-- Adiciona ao cardápio do bar da piscina, categoria "Bebidas", os mesmos
-- itens básicos já existentes no frigobar (mesmo nome e preço).
insert into poolbar_items (category, name, price, position)
select 'Bebidas', v.name, v.price, (select coalesce(max(position), 0) from poolbar_items) + v.rn
from (
  values
    ('Água sem gás', 5.00, 1),
    ('Água com gás', 6.00, 2),
    ('Refrigerante', 10.00, 3),
    ('Cerveja', 12.00, 4),
    ('Café expresso', 7.00, 5)
) as v(name, price, rn);

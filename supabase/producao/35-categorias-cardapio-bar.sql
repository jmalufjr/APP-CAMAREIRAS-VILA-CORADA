-- Cardapio do bar da piscina: 3 categorias fixas (Petiscos, Drinks, Outras bebidas).
-- 1) tudo que nao e Petiscos (inclusive o antigo "Bebidas" e itens sem categoria) vira "Outras bebidas"
update poolbar_items set category = 'Outras bebidas' where category is distinct from 'Petiscos';

-- 2) caipirinhas, caipiroskas, caipifrutas, gin tonica, campari e taxa de rolha viram "Drinks"
update poolbar_items set category = 'Drinks'
where category = 'Outras bebidas'
  and (name ilike '%caipirinha%' or name ilike '%caipiroska%' or name ilike '%caipifruta%'
       or name ilike '%gin t%nica%' or name ilike '%campari%' or name ilike '%taxa de rolha%');

-- 3) so essas tres categorias sao aceitas daqui em diante
alter table poolbar_items drop constraint if exists poolbar_items_category_check;
alter table poolbar_items add constraint poolbar_items_category_check
  check (category in ('Petiscos','Drinks','Outras bebidas'));

-- Conferencia: como ficou cada item
select category, name from poolbar_items order by category, name;

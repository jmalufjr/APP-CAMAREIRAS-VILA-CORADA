-- Itens de estoque de "consumo autônomo" direto (ver PRD_compras.md
-- seção 19) — produtos vendidos prontos no bar da piscina/frigobar, sem
-- nenhuma composição (abrir uma lata/garrafa e servir), diferente dos
-- petiscos/drinks preparados (esses ficam sem ficha técnica por ora,
-- cadastrados na tela "Lista de pratos" sem receita até o proprietário
-- preencher as quantidades reais). A ficha técnica 1-pra-1
-- (portions_count=1, amount_per_portion=1) aqui não é um palpite — é
-- matematicamente exata por definição (1 unidade vendida = 1 unidade
-- consumida do próprio item).

do $$
declare
  v_bar_piscina uuid := (select id from expense_categories where name = 'Bar da piscina');
  v_frigobar uuid := (select id from expense_categories where name = 'Frigobar');
  v_item_id uuid;
  v_poolbar_id uuid;
  v_minibar_id uuid;
  v_name text;
begin
  foreach v_name in array array['Água com gás', 'Água sem gás', 'Água de Coco', 'Café expresso', 'Cerveja', 'Refrigerante']
  loop
    insert into inventory_items (name, unit)
    values (v_name, 'un')
    returning id into v_item_id;

    insert into inventory_item_categories (inventory_item_id, category_id) values (v_item_id, v_bar_piscina);

    select id into v_poolbar_id from poolbar_items where name = v_name;
    if v_poolbar_id is not null then
      insert into inventory_item_recipes (inventory_item_id, poolbar_item_id, portions_count, amount_per_portion)
      values (v_item_id, v_poolbar_id, 1, 1);
    end if;

    select id into v_minibar_id from minibar_items where name = v_name;
    if v_minibar_id is not null then
      insert into inventory_item_categories (inventory_item_id, category_id)
      values (v_item_id, v_frigobar)
      on conflict do nothing;
      insert into inventory_item_recipes (inventory_item_id, minibar_item_id, portions_count, amount_per_portion)
      values (v_item_id, v_minibar_id, 1, 1);
    end if;
  end loop;
end $$;

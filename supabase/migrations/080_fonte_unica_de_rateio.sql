-- 080: UMA fonte de rateio só. O rateio por lançamento (expense_items.center_split)
-- sai; o rateio do item de custo (cost_item_centers) é o único, editável no
-- cadastro e no Demonstrativo de Custos. Perdas e ajustes de inventário passam
-- a seguir esse rateio (antes usavam só o centro principal).
alter table expense_items drop column if exists center_split;

create or replace function post_inventory_movement_ledger() returns trigger as $$
declare
  v_cost_item_id uuid;
  v_ledger_code text;
  v_stock_account text;
  v_counter text;
  v_center uuid;
  v_center_name text;
  v_value numeric;
  v_item_name text;
  v_origin text;
  v_desc text;
  v_date date;
  v_lines jsonb;
  v_counter_lines jsonb;
  v_rec record;
  v_part numeric;
  v_acc numeric;
  v_i int;
begin
  if new.movement_type = 'compra' then
    return new;
  end if;
  v_value := round(abs(new.total_value), 2);
  if v_value <= 0 then
    return new;
  end if;

  select ci.id, ci.ledger_account_code into v_cost_item_id, v_ledger_code
  from cost_items ci where ci.inventory_item_id = new.inventory_item_id limit 1;
  v_stock_account := coalesce(v_ledger_code, 'estoque-outros');
  select name into v_item_name from inventory_items where id = new.inventory_item_id;
  v_date := (new.created_at at time zone 'America/Sao_Paulo')::date;
  v_center := new.consumption_center_id;
  select name into v_center_name from cost_centers where id = v_center;

  if new.movement_type = 'baixa_consumo_hospede' then
    v_origin := 'consumo';
    v_desc := case when new.total_value < 0 then 'Consumo de ' else 'Estorno de consumo de ' end
      || coalesce(lower(v_center_name), 'bar/frigobar') || ' — ' || coalesce(v_item_name, 'item');
    if v_center_name = 'Frigobar' then
      v_counter := 'cmv-bebidas-frigobar';
    else
      v_counter := case v_stock_account
        when 'estoque-bebidas' then 'cmv-bebidas-bar'
        when 'estoque-alimentos' then 'custo-petiscos-bar'
        else 'custo-drinks-bar' end;
    end if;
  elsif new.movement_type = 'baixa_manual' then
    v_origin := 'baixa-manual';
    if new.is_loss then
      v_desc := 'Perda/quebra de estoque — ' || coalesce(v_item_name, 'item');
      v_counter := 'perdas-estoque';
    else
      v_desc := 'Baixa manual de estoque — ' || coalesce(v_item_name, 'item') || coalesce(' (' || v_center_name || ')', '');
      v_counter := case v_center_name
        when 'Café da manhã' then 'custo-cafe-manha'
        when 'Frigobar' then 'cmv-bebidas-frigobar'
        when 'Hospedagem' then 'materiais-limpeza-hospedagem'
        when 'Administração e áreas comuns' then 'material-administrativo'
        when 'Bar de piscina' then (case v_stock_account
          when 'estoque-bebidas' then 'cmv-bebidas-bar'
          when 'estoque-alimentos' then 'custo-petiscos-bar'
          else 'custo-drinks-bar' end)
        else 'perdas-estoque' end;
    end if;
  elsif new.movement_type = 'ajuste_contagem' then
    v_origin := 'inventario';
    v_desc := case when new.total_value < 0 then 'Ajuste de inventário (falta) — ' else 'Ajuste de inventário (sobra) — ' end || coalesce(v_item_name, 'item');
    v_counter := 'perdas-estoque';
  else
    return new;
  end if;

  -- Contrapartida (custo/perda): se o destino foi escolhido na baixa, vai inteira
  -- pra esse centro; senão (perda, ajuste de inventário) segue o RATEIO do item
  -- de custo — a ÚNICA fonte de rateio do sistema (cost_item_centers).
  v_counter_lines := '[]'::jsonb;
  if v_center is not null or v_cost_item_id is null then
    v_counter_lines := jsonb_build_array(jsonb_build_object('center', v_center, 'amount', v_value));
  else
    v_acc := 0;
    for v_rec in select center_id, alloc_pct from cost_item_centers where cost_item_id = v_cost_item_id order by alloc_pct desc, center_id loop
      v_part := round(v_value * v_rec.alloc_pct / 100, 2);
      v_acc := v_acc + v_part;
      v_counter_lines := v_counter_lines || jsonb_build_array(jsonb_build_object('center', v_rec.center_id, 'amount', v_part));
    end loop;
    if jsonb_array_length(v_counter_lines) = 0 then
      v_counter_lines := jsonb_build_array(jsonb_build_object('center', null, 'amount', v_value));
    elsif v_acc <> v_value then
      -- sobra de arredondamento vai na primeira linha (a de maior percentual)
      v_counter_lines := jsonb_set(v_counter_lines, '{0,amount}', to_jsonb(((v_counter_lines->0->>'amount')::numeric) + (v_value - v_acc)));
    end if;
  end if;

  v_lines := '[]'::jsonb;
  for v_i in 0 .. jsonb_array_length(v_counter_lines) - 1 loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_code', v_counter,
      'cost_center_id', v_counter_lines->v_i->>'center',
      'cost_item_id', v_cost_item_id,
      'direction', case when new.total_value < 0 then 'debito' else 'credito' end,
      'amount', (v_counter_lines->v_i->>'amount')::numeric));
  end loop;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_code', v_stock_account,
    'cost_center_id', null,
    'cost_item_id', v_cost_item_id,
    'direction', case when new.total_value < 0 then 'credito' else 'debito' end,
    'amount', v_value));

  perform post_ledger_entry_core(v_date, v_date, null, v_desc, v_origin, 'inventory_movements', new.id, v_lines, new.created_by);
  return new;
end;
$$ language plpgsql security definer;

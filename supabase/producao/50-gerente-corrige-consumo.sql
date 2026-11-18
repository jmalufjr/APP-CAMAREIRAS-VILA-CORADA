-- Gerente operacional tambem corrige consumo de bar e de frigobar (editar/cancelar comanda, editar coluna do
-- frigobar e lancamento adicional com a conta fechada). Quem lancou a comanda e o admin continuam podendo;
-- camareira que nao lancou a comanda continua sem poder. Pre-requisito: 122.

create or replace function edit_comanda(p_comanda_id uuid, p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica', p_bill_id uuid default null)
returns void as $$
declare
  v_old_bill_id uuid;
  v_old_bill_status room_bill_status;
  v_old_comanda_status comanda_status;
  v_old_seq int;
  v_new_bill_id uuid;
  v_new_bill_status room_bill_status;
  v_next_seq int;
  v_item jsonb;
  v_created_by uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if not (is_camareira() or is_admin_or_gerente()) then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

  select c.bill_id, c.status, c.sequence_number, b.status, c.created_by
    into v_old_bill_id, v_old_comanda_status, v_old_seq, v_old_bill_status, v_created_by
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_old_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if not is_admin_or_gerente() and v_created_by is distinct from auth.uid() then
    raise exception 'Somente quem lançou a comanda (ou o administrador) pode editá-la.';
  end if;
  if v_old_comanda_status = 'cancelada' then
    raise exception 'Comanda cancelada não pode ser editada.';
  end if;
  if v_old_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  if p_bill_id is not null then
    select id, status into v_new_bill_id, v_new_bill_status
    from room_bills where id = p_bill_id and room_id is not distinct from p_room_id and status <> 'paga'
    for update;
    if v_new_bill_id is null then
      raise exception 'Conta não encontrada ou já paga.';
    end if;
  else
    select id, status into v_new_bill_id, v_new_bill_status
    from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
    order by (stays_reservation_id is null) desc
    limit 1
    for update;

    if v_new_bill_id is null then
      insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
      returning id, status into v_new_bill_id, v_new_bill_status;
    end if;
  end if;

  if v_new_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  if v_new_bill_id <> v_old_bill_id then
    select coalesce(max(sequence_number), 0) + 1 into v_next_seq
    from bar_comandas where bill_id = v_new_bill_id;
  else
    v_next_seq := v_old_seq;
  end if;

  update bar_comandas
  set room_id = p_room_id,
      bill_id = v_new_bill_id,
      sequence_number = v_next_seq,
      status = 'editada',
      last_action_by = auth.uid(),
      last_action_at = now()
  where id = p_comanda_id;

  -- Estorna o estoque dos itens ANTIGOS (já baixado quando a comanda foi
  -- lançada/editada da última vez) antes de substituí-los.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    sum(bci.quantity * r.portions_count * r.amount_per_portion), v_old_bill_id,
    'Estorno de estoque — comanda editada'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = p_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;

  select coalesce(jsonb_agg(jsonb_build_object('item', pi.name, 'quantity', i.quantity, 'preco', i.price_snapshot) order by pi.name), '[]'::jsonb)
    into v_before
  from bar_comanda_items i join poolbar_items pi on pi.id = i.poolbar_item_id
  where i.comanda_id = p_comanda_id;

  delete from bar_comanda_items where comanda_id = p_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select p_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('item', pi.name, 'quantity', i.quantity, 'preco', i.price_snapshot) order by pi.name), '[]'::jsonb)
    into v_after
  from bar_comanda_items i join poolbar_items pi on pi.id = i.poolbar_item_id
  where i.comanda_id = p_comanda_id;
  insert into bar_comanda_history (comanda_id, bill_id, from_bill_id, action, actor_id, items_before, items_after)
  values (p_comanda_id, v_new_bill_id, v_old_bill_id, 'editada', auth.uid(), v_before, v_after);

  -- Baixa o estoque dos itens NOVOS.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    -sum(bci.quantity * r.portions_count * r.amount_per_portion), v_new_bill_id,
    'Baixa automática ao editar a comanda'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = p_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;
end;
$$ language plpgsql security definer;

create or replace function cancel_comanda(p_comanda_id uuid, p_ingredients_recovered boolean)
returns void as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_old_status comanda_status;
  v_created_by uuid;
  v_before jsonb;
begin
  if not (is_camareira() or is_admin_or_gerente()) then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

  select c.bill_id, c.status, b.status, c.created_by into v_bill_id, v_old_status, v_bill_status, v_created_by
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if not is_admin_or_gerente() and v_created_by is distinct from auth.uid() then
    raise exception 'Somente quem lançou a comanda (ou o administrador) pode cancelá-la.';
  end if;
  if v_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('item', pi.name, 'quantity', i.quantity, 'preco', i.price_snapshot) order by pi.name), '[]'::jsonb)
    into v_before
  from bar_comanda_items i join poolbar_items pi on pi.id = i.poolbar_item_id
  where i.comanda_id = p_comanda_id;
  if v_old_status <> 'cancelada' then
    insert into bar_comanda_history (comanda_id, bill_id, action, actor_id, items_before, items_after)
    values (p_comanda_id, v_bill_id, 'cancelada', auth.uid(), v_before, '[]'::jsonb);
  end if;

  update bar_comandas
  set status = 'cancelada', last_action_by = auth.uid(), last_action_at = now()
  where id = p_comanda_id and status <> 'cancelada';

  if v_old_status <> 'cancelada' and p_ingredients_recovered then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede',
      sum(bci.quantity * r.portions_count * r.amount_per_portion), v_bill_id,
      'Estorno de estoque — comanda cancelada (ingredientes recuperados)'
    from bar_comanda_items bci
    join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
    where bci.comanda_id = p_comanda_id and bci.quantity > 0
    group by r.inventory_item_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function set_minibar_consumption(p_bill_id uuid, p_minibar_item_id uuid, p_quantity int)
returns void as $$
declare
  v_bill_status room_bill_status;
  v_price numeric;
  v_old_quantity int;
  v_new_quantity int;
  v_delta int;
begin
  if not (is_camareira() or is_admin_or_gerente()) then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Frigobar', true);

  select status into v_bill_status from room_bills where id = p_bill_id for update;
  if v_bill_status is null then
    raise exception 'Conta não encontrada.';
  end if;
  if v_bill_status = 'fechada' and coalesce(current_setting('app.minibar_allow_closed', true), '') <> 'on' then
    raise exception 'A conta desta suíte está fechada. Não é possível registrar consumo.';
  end if;

  select price into v_price from minibar_items where id = p_minibar_item_id;
  if v_price is null then
    raise exception 'Item de frigobar não encontrado.';
  end if;

  select quantity into v_old_quantity
  from room_bill_minibar_items
  where bill_id = p_bill_id and minibar_item_id = p_minibar_item_id
  for update;
  v_old_quantity := coalesce(v_old_quantity, 0);
  v_new_quantity := greatest(0, p_quantity);

  insert into room_bill_minibar_items (bill_id, minibar_item_id, quantity, price_snapshot, updated_at)
  values (p_bill_id, p_minibar_item_id, v_new_quantity, v_price, now())
  on conflict (bill_id, minibar_item_id)
  do update set quantity = excluded.quantity, price_snapshot = excluded.price_snapshot, updated_at = excluded.updated_at;

  v_delta := v_new_quantity - v_old_quantity;
  if v_delta <> 0 then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -(v_delta * r.portions_count * r.amount_per_portion), p_bill_id,
      case when v_delta > 0
        then 'Baixa automática ao lançar consumo de frigobar'
        else 'Estorno de estoque — frigobar reduzido'
      end
    from inventory_item_recipes r
    where r.minibar_item_id = p_minibar_item_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function set_minibar_consumption_closed(p_bill_id uuid, p_minibar_item_id uuid, p_quantity int)
returns void as $$
declare
  v_status room_bill_status;
begin
  if not (is_camareira() or is_admin_or_gerente()) then
    raise exception 'not authorized';
  end if;
  select status into v_status from room_bills where id = p_bill_id;
  if v_status is distinct from 'fechada' then
    raise exception 'O lançamento adicional só vale para conta fechada.';
  end if;
  perform set_config('app.minibar_allow_closed', 'on', true);
  perform set_minibar_consumption(p_bill_id, p_minibar_item_id, p_quantity);
  perform set_config('app.minibar_allow_closed', '', true);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function edit_minibar_column(p_bill_id uuid, p_column_key text, p_changes jsonb)
returns void as $$
declare
  v_status room_bill_status;
  v_ch jsonb;
  v_item uuid;
  v_new int;
  v_old int;
  v_total int;
begin
  if not (is_camareira() or is_admin_or_gerente()) then
    raise exception 'not authorized';
  end if;
  select status into v_status from room_bills where id = p_bill_id for update;
  if v_status is null then
    raise exception 'Conta não encontrada.';
  end if;
  if v_status = 'paga' then
    raise exception 'Conta paga não pode ser alterada.';
  end if;

  perform set_config('app.minibar_allow_closed', 'on', true);
  perform set_config('app.minibar_columns_managed', 'on', true);
  perform set_config('app.minibar_source', 'edicao', true);
  perform set_config('app.minibar_column', p_column_key, true);

  for v_ch in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb))
  loop
    v_item := (v_ch->>'item_id')::uuid;
    v_new := coalesce((v_ch->>'quantity')::int, 0);
    if v_new < 0 then
      raise exception 'Quantidade inválida.';
    end if;

    select quantity into v_old from room_bill_minibar_columns
    where bill_id = p_bill_id and column_key = p_column_key and minibar_item_id = v_item;
    v_old := coalesce(v_old, 0);
    if v_new = v_old then
      continue;
    end if;

    insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity)
    values (p_bill_id, p_column_key, v_item, v_new)
    on conflict (bill_id, column_key, minibar_item_id)
    do update set quantity = excluded.quantity, updated_at = now();

    select coalesce(sum(quantity), 0) into v_total from room_bill_minibar_columns
    where bill_id = p_bill_id and minibar_item_id = v_item;
    perform set_minibar_consumption(p_bill_id, v_item, v_total);

    insert into minibar_edit_history (bill_id, column_key, minibar_item_id, qty_before, qty_after, actor_id)
    values (p_bill_id, p_column_key, v_item, v_old, v_new, auth.uid());
  end loop;

  perform set_config('app.minibar_allow_closed', '', true);
  perform set_config('app.minibar_columns_managed', '', true);
  perform set_config('app.minibar_source', '', true);
  perform set_config('app.minibar_column', '', true);
end;
$$ language plpgsql security definer set search_path = public;

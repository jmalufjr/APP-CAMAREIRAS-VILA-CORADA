-- Bug encontrado em teste manual (Parte 05): com a conta do quarto fechada,
-- editar uma comanda já era bloqueado (edit_comanda só checava o status da
-- conta do quarto DE DESTINO), mas cancel_comanda não checava status
-- nenhum — permitia cancelar uma comanda de um quarto com a conta fechada.
-- Corrige as duas: agora nenhuma ação (editar ou cancelar) é permitida
-- numa comanda cuja conta atual está fechada, independentemente do quarto
-- de destino escolhido na edição.

create or replace function edit_comanda(p_comanda_id uuid, p_room_id uuid, p_items jsonb)
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
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select c.bill_id, c.status, c.sequence_number, b.status
    into v_old_bill_id, v_old_comanda_status, v_old_seq, v_old_bill_status
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_old_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_old_comanda_status = 'cancelada' then
    raise exception 'Comanda cancelada não pode ser editada.';
  end if;
  if v_old_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  select id, status into v_new_bill_id, v_new_bill_status
  from room_bills where room_id = p_room_id and status <> 'paga'
  for update;

  if v_new_bill_id is null then
    insert into room_bills (room_id, status) values (p_room_id, 'aberta')
    returning id, status into v_new_bill_id, v_new_bill_status;
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

  delete from bar_comanda_items where comanda_id = p_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select p_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;
end;
$$ language plpgsql security definer;

create or replace function cancel_comanda(p_comanda_id uuid)
returns void as $$
declare
  v_bill_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select b.status into v_bill_status
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_bill_status is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  update bar_comandas
  set status = 'cancelada', last_action_by = auth.uid(), last_action_at = now()
  where id = p_comanda_id and status <> 'cancelada';
end;
$$ language plpgsql security definer;

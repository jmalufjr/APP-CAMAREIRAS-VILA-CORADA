-- Correcao de servico: a executora corrige o consumo de frigobar DO DIA (diferencial) que ela
-- lancou; a conta do hospede e ajustada pela diferenca (novo valor do dia - valor antigo do dia).
-- Pre-requisito: 115.
create or replace function apply_correction_minibar(p_task_id uuid, p_bill_id uuid, p_changes jsonb)
returns void as $$
declare
  v_room uuid;
  v_bill uuid;
  v_bill_room uuid;
  v_ch jsonb;
  v_item uuid;
  v_new int;
  v_old_day int;
  v_cur int;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  select room_id into v_room from daily_room_tasks
  where id = p_task_id and assigned_to = auth.uid() and status in ('aguardando_correcao', 'em_correcao')
  for update;
  if v_room is null then
    raise exception 'Este serviço não está em correção.';
  end if;

  for v_ch in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb))
  loop
    v_item := (v_ch->>'item_id')::uuid;
    v_new := greatest(0, coalesce((v_ch->>'quantity')::int, 0));

    select quantity, bill_id into v_old_day, v_bill from daily_room_task_minibar_items
    where task_id = p_task_id and minibar_item_id = v_item;
    v_old_day := coalesce(v_old_day, 0);
    v_bill := coalesce(v_bill, p_bill_id);
    if v_bill is null then
      raise exception 'Não foi possível identificar a conta do hóspede.';
    end if;
    select room_id into v_bill_room from room_bills where id = v_bill and status <> 'paga';
    if v_bill_room is distinct from v_room then
      raise exception 'A conta não pertence a esta suíte ou já foi paga.';
    end if;

    if v_new = v_old_day then
      continue;
    end if;

    select quantity into v_cur from room_bill_minibar_items where bill_id = v_bill and minibar_item_id = v_item;
    perform set_minibar_consumption(v_bill, v_item, greatest(0, coalesce(v_cur, 0) + (v_new - v_old_day)));

    if v_new = 0 then
      delete from daily_room_task_minibar_items where task_id = p_task_id and minibar_item_id = v_item;
    else
      insert into daily_room_task_minibar_items (task_id, minibar_item_id, quantity, bill_id)
      values (p_task_id, v_item, v_new, v_bill)
      on conflict (task_id, minibar_item_id) do update set quantity = excluded.quantity;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

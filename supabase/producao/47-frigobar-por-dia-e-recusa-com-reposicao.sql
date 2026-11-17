-- Frigobar por dia na conta, "hospede nao quis o servico" com reposicao de frigobar.
-- Pre-requisito: 115 e 116.

-- 1) Cada mudanca de frigobar agora diz de onde veio (servico/correcao ou lancamento adicional)
--    e, no caso de servico, de qual servico. Registros antigos ficam com source nulo.
alter table minibar_launches add column if not exists source text;
alter table minibar_launches add column if not exists task_id uuid;

create or replace function log_minibar_launch() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d int;
  v_source text := nullif(current_setting('app.minibar_source', true), '');
  v_task text := nullif(current_setting('app.minibar_task', true), '');
begin
  if tg_op = 'INSERT' then
    d := new.quantity;
  else
    d := new.quantity - old.quantity;
  end if;
  if d <> 0 then
    insert into minibar_launches (bill_id, minibar_item_id, delta, unit_price, source, task_id)
    values (new.bill_id, new.minibar_item_id, d, new.price_snapshot,
            coalesce(v_source, 'adicional'),
            case when v_source = 'servico' then v_task::uuid else null end);
  end if;
  return new;
end;
$$;

-- 2) Servico "nao realizado a pedido, com reposicao de frigobar".
alter table daily_room_tasks add column if not exists declined_restock boolean not null default false;

create or replace function decline_service_with_restock(p_task_id uuid) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from daily_room_tasks
    where id = p_task_id and assigned_to = auth.uid()
      and status in ('pendente', 'em_andamento')
      and task_type in ('arrumacao', 'troca')
  ) then
    raise exception 'not authorized';
  end if;
  update daily_room_tasks
  set guest_declined = true, declined_restock = true, status = 'em_andamento',
      claimed_at = case when started_at is null then now() else claimed_at end,
      started_at = coalesce(started_at, now())
  where id = p_task_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function finalize_daily_room_task(
  p_task_id uuid,
  p_checked_ids uuid[],
  p_notes text,
  p_bedlinen boolean,
  p_occurrences jsonb,
  p_minibar jsonb,
  p_bill_id uuid
) returns jsonb as $$
declare
  v_room_id uuid;
  v_type checklist_type;
  v_occ jsonb;
  v_occ_id uuid;
  v_occ_ids jsonb := '[]'::jsonb;
  v_item jsonb;
  v_qty int;
  v_old int;
  v_bill_room uuid;
  v_has_minibar boolean := false;
  v_restock boolean;
  v_notes text;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select room_id, task_type, declined_restock into v_room_id, v_type, v_restock
  from daily_room_tasks
  where id = p_task_id and assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  for update;
  if v_room_id is null then
    raise exception 'Este serviço não está disponível para finalizar.';
  end if;

  if not v_restock and exists (
    select 1 from daily_room_task_checks c
    where c.daily_room_task_id = p_task_id and not (c.id = any (coalesce(p_checked_ids, '{}'::uuid[])))
  ) then
    raise exception 'Marque todos os itens do checklist antes de finalizar o serviço.';
  end if;

  if not v_restock then
    update daily_room_task_checks
    set checked = true, checked_at = coalesce(checked_at, now())
    where daily_room_task_id = p_task_id;
  end if;

  if v_type = 'arrumacao' and not v_restock then
    update daily_room_tasks set bedlinen_changed = coalesce(p_bedlinen, false) where id = p_task_id;
  end if;

  for v_occ in select * from jsonb_array_elements(coalesce(p_occurrences, '[]'::jsonb))
  loop
    insert into daily_room_task_occurrences (daily_room_task_id, occurrence_category_id, description)
    values (p_task_id, (v_occ->>'category_id')::uuid, nullif(v_occ->>'description', ''))
    returning id into v_occ_id;
    v_occ_ids := v_occ_ids || to_jsonb(v_occ_id);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_minibar, '[]'::jsonb))
  loop
    if coalesce((v_item->>'quantity')::int, 0) > 0 then
      v_has_minibar := true;
    end if;
  end loop;

  if v_has_minibar then
    if p_bill_id is null then
      raise exception 'Não foi possível identificar a conta do hóspede para lançar o frigobar.';
    end if;
    select room_id into v_bill_room from room_bills where id = p_bill_id and status <> 'paga';
    if v_bill_room is distinct from v_room_id then
      raise exception 'A conta escolhida não pertence a esta suíte.';
    end if;

    perform set_config('app.minibar_source', 'servico', true);
    perform set_config('app.minibar_task', p_task_id::text, true);
    for v_item in select * from jsonb_array_elements(p_minibar)
    loop
      v_qty := coalesce((v_item->>'quantity')::int, 0);
      if v_qty > 0 then
        select quantity into v_old from room_bill_minibar_items
        where bill_id = p_bill_id and minibar_item_id = (v_item->>'item_id')::uuid;
        perform set_minibar_consumption(p_bill_id, (v_item->>'item_id')::uuid, coalesce(v_old, 0) + v_qty);
        insert into daily_room_task_minibar_items (task_id, minibar_item_id, quantity, bill_id)
        values (p_task_id, (v_item->>'item_id')::uuid, v_qty, p_bill_id)
        on conflict (task_id, minibar_item_id) do update set quantity = excluded.quantity;
      end if;
    end loop;
  end if;

  perform set_config('app.minibar_source', '', true);
  perform set_config('app.minibar_task', '', true);

  update daily_room_tasks
  set claimed_at = case when started_at is null then now() else claimed_at end,
      started_at = coalesce(started_at, now())
  where id = p_task_id;

  if v_restock then
    -- Nao realizado a pedido, com reposicao de frigobar: conclui direto (sem checklist, sem revisao).
    v_notes := nullif(p_notes, '');
    update daily_room_tasks
    set status = 'concluido', finished_at = now(), released_at = now(), completed_at = now(), notes = v_notes
    where id = p_task_id;
  else
    perform release_daily_room_task(p_task_id, p_notes);
  end if;

  return jsonb_build_object('occurrence_ids', v_occ_ids);
end;
$$ language plpgsql security definer set search_path = public;

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

  perform set_config('app.minibar_source', 'servico', true);
  perform set_config('app.minibar_task', p_task_id::text, true);

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

  perform set_config('app.minibar_source', '', true);
  perform set_config('app.minibar_task', '', true);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function cancel_own_claimed_task(p_task_id uuid) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  if exists (
    select 1 from daily_room_tasks
    where id = p_task_id and second_assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  ) then
    update daily_room_tasks
    set second_assigned_to = null, second_claimed_at = null, claimed_at = null
    where id = p_task_id;
    return;
  end if;

  if not exists (
    select 1 from daily_room_tasks
    where id = p_task_id and assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  ) then
    raise exception 'not authorized';
  end if;

  delete from daily_room_task_occurrences where daily_room_task_id = p_task_id;

  update daily_room_task_checks
  set checked = false, checked_at = null
  where daily_room_task_id = p_task_id;

  update daily_room_tasks
  set assigned_to = null, claimed_at = null, started_at = null, status = 'pendente', notes = null,
      second_assigned_to = null, second_claimed_at = null, guest_declined = false, declined_restock = false
  where id = p_task_id;
end;
$$ language plpgsql security definer;

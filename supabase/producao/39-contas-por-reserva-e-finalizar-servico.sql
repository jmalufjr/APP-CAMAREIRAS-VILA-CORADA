-- Contas por reserva (suite + hospede + referencia da Stays), checklist com consumo
-- DIFERENCIAL gravado so ao finalizar o servico, e novo fluxo Comecar / Cancelar escolha.
-- Pre-requisito: migracoes ate 114 ja rodadas.

-- 1) Datas da estadia na conta (para separar "hospedes na pousada" dos que ja sairam).
alter table room_bills
  add column if not exists stay_check_in date,
  add column if not exists stay_check_out date;

-- 2) Fim do limite de 2 contas por suite: a conta passa a ser unica por (suite, reserva).
do $$
declare
  v_dups text;
begin
  select string_agg(room_id::text || ' / ' || stays_reservation_id || ' (' || n || ' contas)', '; ')
    into v_dups
  from (
    select room_id, stays_reservation_id, count(*) n
    from room_bills
    where status <> 'paga' and stays_reservation_id is not null
    group by room_id, stays_reservation_id
    having count(*) > 1
  ) d;
  if v_dups is not null then
    raise exception 'Existem contas nao pagas repetidas para a mesma suite e reserva: %', v_dups;
  end if;
end $$;

drop index if exists room_bills_one_active_per_room_slot;
create unique index if not exists room_bills_one_open_per_reservation
  on room_bills(room_id, stays_reservation_id)
  where status <> 'paga' and stays_reservation_id is not null;
create index if not exists room_bills_room_open_idx on room_bills(room_id) where status <> 'paga';

-- 3) Quem dormiu em cada suite na noite anterior a cada data (gravado pela sincronizacao).
create table if not exists room_night_occupancy (
  date date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  stays_reservation_id text not null,
  guest_name text,
  check_in date,
  check_out date,
  primary key (date, room_id)
);
alter table room_night_occupancy enable row level security;
drop policy if exists rno_select on room_night_occupancy;
create policy rno_select on room_night_occupancy for select using (auth.uid() is not null);

-- 4) Consumo de frigobar DO DIA registrado em cada servico (o que a camareira lancou ao finalizar).
create table if not exists daily_room_task_minibar_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references daily_room_tasks(id) on delete cascade,
  minibar_item_id uuid not null references minibar_items(id),
  quantity int not null check (quantity > 0),
  bill_id uuid references room_bills(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (task_id, minibar_item_id)
);
alter table daily_room_task_minibar_items enable row level security;
drop policy if exists drtmi_select on daily_room_task_minibar_items;
create policy drtmi_select on daily_room_task_minibar_items for select
  using (
    is_admin_or_gerente()
    or exists (select 1 from daily_room_tasks t where t.id = task_id and t.assigned_to = auth.uid())
  );

-- 5) Conta de uma reserva: acha ou cria (nunca duplica).
create or replace function ensure_room_bill_for_reservation(
  p_room_id uuid, p_reservation_id text, p_guest_name text, p_check_in date, p_check_out date
) returns room_bills as $$
declare
  v_bill room_bills;
begin
  if not (is_camareira() or is_admin_or_gerente()) then
    raise exception 'not authorized';
  end if;
  if p_reservation_id is null or p_reservation_id = '' then
    raise exception 'Reserva nao informada.';
  end if;

  select * into v_bill from room_bills
  where room_id = p_room_id and stays_reservation_id = p_reservation_id and status <> 'paga'
  limit 1;
  if v_bill.id is not null then
    return v_bill;
  end if;

  begin
    insert into room_bills (room_id, status, guest_slot, stays_reservation_id, guest_name_hint, stay_check_in, stay_check_out)
    values (p_room_id, 'aberta', 'unica', p_reservation_id, p_guest_name, p_check_in, p_check_out)
    returning * into v_bill;
  exception when unique_violation then
    select * into v_bill from room_bills
    where room_id = p_room_id and stays_reservation_id = p_reservation_id and status <> 'paga'
    limit 1;
  end;
  return v_bill;
end;
$$ language plpgsql security definer set search_path = public;

-- 6) Funcoes de conta: agora aceitam o id da conta (p_bill_id). Sem ele, comportam-se como antes.
drop function if exists close_room_bill(uuid, room_bill_guest_slot);
drop function if exists reopen_room_bill(uuid, room_bill_guest_slot);
drop function if exists pay_room_bill(uuid, payment_method, room_bill_guest_slot);
drop function if exists set_room_bill_service_charge_waived(uuid, boolean, room_bill_guest_slot);
drop function if exists submit_comanda_signed(uuid, jsonb, room_bill_guest_slot, text);
drop function if exists submit_comanda(uuid, jsonb, room_bill_guest_slot);
drop function if exists edit_comanda(uuid, uuid, jsonb, room_bill_guest_slot);

create or replace function close_room_bill(p_room_id uuid, p_guest_slot room_bill_guest_slot default 'unica', p_bill_id uuid default null)
returns void as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  if p_bill_id is not null then
    select id, status into v_bill_id, v_status from room_bills
    where id = p_bill_id and room_id = p_room_id and status <> 'paga' for update;
  else
    select id, status into v_bill_id, v_status from room_bills
    where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
    order by (stays_reservation_id is null) desc limit 1 for update;
  end if;
  if v_bill_id is null then
    raise exception 'Conta não encontrada.';
  end if;
  if v_status = 'fechada' then
    raise exception 'A conta deste quarto já está fechada.';
  end if;

  update room_bills set status = 'fechada', closed_at = now(), closed_by = auth.uid() where id = v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function reopen_room_bill(p_room_id uuid, p_guest_slot room_bill_guest_slot default 'unica', p_bill_id uuid default null)
returns void as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  if p_bill_id is not null then
    select id, status into v_bill_id, v_status from room_bills
    where id = p_bill_id and room_id = p_room_id and status <> 'paga' for update;
  else
    select id, status into v_bill_id, v_status from room_bills
    where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
    order by (stays_reservation_id is null) desc limit 1 for update;
  end if;
  if v_status is distinct from 'fechada' then
    raise exception 'Só é possível reabrir uma conta fechada.';
  end if;

  update room_bills set status = 'reaberta', reopened_at = now(), reopened_by = auth.uid() where id = v_bill_id;
end;
$$ language plpgsql security definer;

-- Pagar NAO cria mais uma conta nova: as contas nascem da reserva (sincronizacao / checklist / comanda).
create or replace function pay_room_bill(p_room_id uuid, p_payment_method payment_method, p_guest_slot room_bill_guest_slot default 'unica', p_bill_id uuid default null)
returns uuid as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  if p_bill_id is not null then
    select id, status into v_bill_id, v_status from room_bills
    where id = p_bill_id and room_id = p_room_id and status <> 'paga' for update;
  else
    select id, status into v_bill_id, v_status from room_bills
    where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
    order by (stays_reservation_id is null) desc limit 1 for update;
  end if;
  if v_status is distinct from 'fechada' then
    raise exception 'Feche a conta antes de registrar o pagamento.';
  end if;

  update room_bills
  set status = 'paga', paid_at = now(), paid_by = auth.uid(), payment_method = p_payment_method
  where id = v_bill_id;

  return v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function set_room_bill_service_charge_waived(p_room_id uuid, p_waived boolean, p_guest_slot room_bill_guest_slot default 'unica', p_bill_id uuid default null)
returns void as $$
declare
  v_bill_id uuid;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  if p_bill_id is not null then
    select id into v_bill_id from room_bills
    where id = p_bill_id and room_id = p_room_id and status <> 'paga' for update;
  else
    select id into v_bill_id from room_bills
    where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
    order by (stays_reservation_id is null) desc limit 1 for update;
  end if;
  if v_bill_id is null then
    raise exception 'Conta não encontrada.';
  end if;

  update room_bills set service_charge_waived = p_waived where id = v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function submit_comanda(p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica', p_bill_id uuid default null)
returns uuid as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_comanda_id uuid;
  v_next_seq int;
  v_next_monthly int;
  v_item jsonb;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

  if p_bill_id is not null then
    -- Conta escolhida explicitamente (suíte + hóspede + reserva).
    select id, status into v_bill_id, v_bill_status
    from room_bills where id = p_bill_id and room_id = p_room_id and status <> 'paga'
    for update;
    if v_bill_id is null then
      raise exception 'Conta não encontrada ou já paga.';
    end if;
  else
    select id, status into v_bill_id, v_bill_status
    from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
    order by (stays_reservation_id is null) desc
    limit 1
    for update;

    if v_bill_id is null then
      insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
      returning id, status into v_bill_id, v_bill_status;
    end if;
  end if;

  if v_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  select coalesce(max(sequence_number), 0) + 1 into v_next_seq
  from bar_comandas where bill_id = v_bill_id;

  select coalesce(max(monthly_number), 0) + 1 into v_next_monthly
  from bar_comandas
  where created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  insert into bar_comandas (room_id, bill_id, sequence_number, monthly_number, status, created_by, last_action_by)
  values (p_room_id, v_bill_id, v_next_seq, v_next_monthly, 'original', auth.uid(), auth.uid())
  returning id into v_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select v_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;

  -- Baixa de estoque no momento do pedido (Módulo Contábil Leva 4) — via
  -- ficha técnica, mesma soma por ingrediente de sempre.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    -sum(bci.quantity * r.portions_count * r.amount_per_portion), v_bill_id,
    'Baixa automática ao registrar a comanda'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = v_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;

  return v_comanda_id;
end;
$$ language plpgsql security definer;

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
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

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
  if v_old_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  if p_bill_id is not null then
    select id, status into v_new_bill_id, v_new_bill_status
    from room_bills where id = p_bill_id and room_id = p_room_id and status <> 'paga'
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

  delete from bar_comanda_items where comanda_id = p_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select p_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;

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

create or replace function submit_comanda_signed(
  p_room_id uuid,
  p_items jsonb,
  p_guest_slot room_bill_guest_slot,
  p_signature text,
  p_bill_id uuid default null
) returns uuid as $$
declare
  v_id uuid;
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'Sem permissão.';
  end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' then
    raise exception 'Assinatura inválida.';
  end if;
  if length(p_signature) > 400000 then
    raise exception 'Assinatura grande demais.';
  end if;

  v_id := submit_comanda(p_room_id, p_items, p_guest_slot, p_bill_id);

  update bar_comandas set signature_png = p_signature, signed_at = now() where id = v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 7) Novo fluxo do servico: Comecar (grava o inicio na 1a vez).
create or replace function start_daily_room_task(p_task_id uuid) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from daily_room_tasks
    where id = p_task_id and assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  ) then
    raise exception 'Este serviço não está disponível para começar.';
  end if;
  if exists (
    select 1 from daily_room_tasks
    where id = p_task_id and extra_cleaning and second_assigned_to is null
  ) then
    raise exception 'A limpeza adicional só começa depois que a segunda camareira escolher o serviço.';
  end if;

  update daily_room_tasks
  set claimed_at = case when started_at is null then now() else claimed_at end,
      started_at = coalesce(started_at, now()),
      status = 'em_andamento'
  where id = p_task_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 8) Hospede nao quis o servico: apaga o horario de inicio (o servico vira "sem trabalho").
create or replace function decline_service_by_guest(p_task_id uuid) returns void as $$
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
  set status = 'cancelado', guest_declined = true, cancelled_by = auth.uid(), cancelled_at = now(),
      started_at = null, claimed_at = null
  where id = p_task_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 9) Finalizar o servico: grava TUDO de uma vez (itens, troca de roupa, ocorrencias, consumo
-- diferencial de frigobar, observacoes) e libera a suite. Se algo falhar, nada fica gravado.
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
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select room_id, task_type into v_room_id, v_type
  from daily_room_tasks
  where id = p_task_id and assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  for update;
  if v_room_id is null then
    raise exception 'Este serviço não está disponível para finalizar.';
  end if;

  if exists (
    select 1 from daily_room_task_checks c
    where c.daily_room_task_id = p_task_id and not (c.id = any (coalesce(p_checked_ids, '{}'::uuid[])))
  ) then
    raise exception 'Marque todos os itens do checklist antes de finalizar o serviço.';
  end if;

  update daily_room_task_checks
  set checked = true, checked_at = coalesce(checked_at, now())
  where daily_room_task_id = p_task_id;

  if v_type = 'arrumacao' then
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

  update daily_room_tasks
  set claimed_at = case when started_at is null then now() else claimed_at end,
      started_at = coalesce(started_at, now())
  where id = p_task_id;

  perform release_daily_room_task(p_task_id, p_notes);

  return jsonb_build_object('occurrence_ids', v_occ_ids);
end;
$$ language plpgsql security definer set search_path = public;

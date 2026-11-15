-- Conta AVULSA: de ex-hospede (ja fez check-out) que quer consumir no bar. Sem suite, sem reserva,
-- sem frigobar; identificada pelo nome, telefone e data. Pre-requisito: 115.
alter table room_bills alter column room_id drop not null;
alter table bar_comandas alter column room_id drop not null;
alter table room_bills add column if not exists is_walkin boolean not null default false;
alter table room_bills add column if not exists walkin_phone text;
alter table room_bills drop constraint if exists room_bills_walkin_chk;
alter table room_bills add constraint room_bills_walkin_chk check (is_walkin or room_id is not null);

-- Cria a conta avulsa (so camareira). A data entra como inicio/fim da "estadia" para a conta
-- aparecer em "Hospedes na pousada" no dia e passar para "ja sairam" no dia seguinte.
create or replace function create_walkin_bill(p_name text, p_phone text, p_date date) returns uuid as $$
declare
  v_id uuid;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  if p_name is null or length(trim(p_name)) < 3 then
    raise exception 'Informe o nome completo do hóspede.';
  end if;
  if p_phone is null or length(trim(p_phone)) < 8 then
    raise exception 'Informe o telefone do hóspede.';
  end if;
  insert into room_bills (room_id, status, guest_slot, is_walkin, guest_name_hint, walkin_phone, stay_check_in, stay_check_out)
  values (null, 'aberta', 'unica', true, trim(p_name), trim(p_phone), coalesce(p_date, current_date), coalesce(p_date, current_date))
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Funcoes de conta: agora toleram suite nula (conta avulsa).
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
    where id = p_bill_id and room_id is not distinct from p_room_id and status <> 'paga' for update;
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
    where id = p_bill_id and room_id is not distinct from p_room_id and status <> 'paga' for update;
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
    where id = p_bill_id and room_id is not distinct from p_room_id and status <> 'paga' for update;
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
    where id = p_bill_id and room_id is not distinct from p_room_id and status <> 'paga' for update;
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
    from room_bills where id = p_bill_id and room_id is not distinct from p_room_id and status <> 'paga'
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

-- Conta dividida por hóspede em dias de Saída com Chegada: até então,
-- room_bills era sempre 1 conta por suíte (índice único garantia isso). Se
-- o hóspede que sai não paga antes do hóspede novo chegar e começar a
-- consumir, os dois consumos se misturavam na mesma conta sem nenhuma
-- forma de separar depois quem consumiu o quê. guest_slot resolve isso só
-- nos dias em que a troca realmente acontece — 'unica' (padrão) cobre
-- todo o resto dos dias, sem nenhuma mudança de comportamento.
create type room_bill_guest_slot as enum ('unica', 'saida_hoje', 'chegada_hoje');

alter table room_bills add column guest_slot room_bill_guest_slot not null default 'unica';
-- Só para exibição (nunca usado como chave/identificador) — nome do
-- hóspede buscado na Stays, melhor esforço, pode ficar null.
alter table room_bills add column guest_name_hint text;

drop index room_bills_one_active_per_room;
create unique index room_bills_one_active_per_room_slot
  on room_bills(room_id, guest_slot) where status <> 'paga';

-- As funções abaixo resolviam "a conta do quarto" só por room_id; agora
-- também precisam do slot. Parâmetro novo sempre com valor padrão
-- 'unica', preservando 100% das chamadas existentes sem nenhuma mudança
-- de comportamento — só quem realmente precisa lidar com dia dividido
-- passa um slot diferente.

drop function if exists ensure_room_bill(uuid);
drop function if exists close_room_bill(uuid);
drop function if exists reopen_room_bill(uuid);
drop function if exists pay_room_bill(uuid, payment_method);
drop function if exists set_room_bill_service_charge_waived(uuid, boolean);
drop function if exists submit_comanda(uuid, jsonb);
drop function if exists edit_comanda(uuid, uuid, jsonb);

create or replace function ensure_room_bill(p_room_id uuid, p_guest_slot room_bill_guest_slot default 'unica')
returns room_bills as $$
declare
  v_bill room_bills;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_bill from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga' limit 1;
  if v_bill.id is not null then
    return v_bill;
  end if;

  insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot) returning * into v_bill;
  return v_bill;
end;
$$ language plpgsql security definer;

create or replace function close_room_bill(p_room_id uuid, p_guest_slot room_bill_guest_slot default 'unica')
returns void as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;
  if v_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
    returning id, status into v_bill_id, v_status;
  end if;
  if v_status = 'fechada' then
    raise exception 'A conta deste quarto já está fechada.';
  end if;

  update room_bills set status = 'fechada', closed_at = now(), closed_by = auth.uid() where id = v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function reopen_room_bill(p_room_id uuid, p_guest_slot room_bill_guest_slot default 'unica')
returns void as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;
  if v_status is distinct from 'fechada' then
    raise exception 'Só é possível reabrir uma conta fechada.';
  end if;

  update room_bills set status = 'reaberta', reopened_at = now(), reopened_by = auth.uid() where id = v_bill_id;
end;
$$ language plpgsql security definer;

-- Ao pagar, só nasce uma conta nova 'única' se não sobrar nenhuma outra
-- conta não-paga pro mesmo quarto — evita criar uma terceira conta quando
-- a de "chegada de hoje" já está ativa ao pagar a de "saída de hoje".
create or replace function pay_room_bill(p_room_id uuid, p_payment_method payment_method, p_guest_slot room_bill_guest_slot default 'unica')
returns uuid as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;
  if v_status is distinct from 'fechada' then
    raise exception 'Feche a conta antes de registrar o pagamento.';
  end if;

  update room_bills
  set status = 'paga', paid_at = now(), paid_by = auth.uid(), payment_method = p_payment_method
  where id = v_bill_id;

  if not exists (select 1 from room_bills where room_id = p_room_id and status <> 'paga') then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', 'unica');
  end if;

  return v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function set_room_bill_service_charge_waived(p_room_id uuid, p_waived boolean, p_guest_slot room_bill_guest_slot default 'unica')
returns void as $$
declare
  v_bill_id uuid;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id into v_bill_id
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;
  if v_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot) returning id into v_bill_id;
  end if;

  update room_bills set service_charge_waived = p_waived where id = v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function submit_comanda(p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica')
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

  select id, status into v_bill_id, v_bill_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;

  if v_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
    returning id, status into v_bill_id, v_bill_status;
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

  return v_comanda_id;
end;
$$ language plpgsql security definer;

create or replace function edit_comanda(p_comanda_id uuid, p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica')
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
  if v_old_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  select id, status into v_new_bill_id, v_new_bill_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;

  if v_new_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
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

-- REVERTER O BANCO PARA O QUE A VERSÃO ANTIGA DO APP ESPERA (rode só se precisar
-- voltar o app para a versão anterior ao merge do Módulo Contábil).
--
-- O que a versão antiga NÃO tolera depois das migrations: a função
-- cancel_comanda mudou de assinatura (agora pede se os ingredientes foram
-- recuperados). As outras mudanças são tabelas/colunas/funções NOVAS que o app
-- antigo simplesmente ignora, e ficam no banco sem atrapalhar (nada é apagado,
-- então nenhum dado do Módulo Contábil se perde). Também desliga os gatilhos de
-- lançamento contábil automático e de baixa de estoque, que não fazem sentido
-- sem o app novo.
--
-- Para voltar o BANCO inteiro ao estado de antes (inclusive dados), use o
-- backup feito antes da etapa A — ver PLANO_DEPLOY_PRODUCAO.md.

begin;

drop trigger if exists room_bills_post_ledger on room_bills;
drop trigger if exists inventory_movements_post_ledger on inventory_movements;
drop trigger if exists inventory_movements_consumption_center on inventory_movements;

drop function if exists cancel_comanda(uuid, boolean);

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
  if v_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  update bar_comandas
  set status = 'cancelada', last_action_by = auth.uid(), last_action_at = now()
  where id = p_comanda_id and status <> 'cancelada';
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

commit;

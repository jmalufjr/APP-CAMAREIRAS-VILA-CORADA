-- Historico de lancamentos, edicoes e cancelamentos de comandas (antes e depois, quem e quando).
-- Pre-requisito: 115, 117 e 119.
create table if not exists bar_comanda_history (
  id bigserial primary key,
  comanda_id uuid not null references bar_comandas(id) on delete cascade,
  bill_id uuid,
  from_bill_id uuid,
  action text not null check (action in ('lancada', 'editada', 'cancelada')),
  actor_id uuid references profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  items_before jsonb,
  items_after jsonb
);
create index if not exists bar_comanda_history_comanda_idx on bar_comanda_history(comanda_id, occurred_at);
alter table bar_comanda_history enable row level security;
drop policy if exists bch_select on bar_comanda_history;
create policy bch_select on bar_comanda_history for select using (auth.uid() is not null);

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
  if not (is_camareira() or is_admin()) then
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
  if not is_admin() and v_created_by is distinct from auth.uid() then
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
  if not (is_camareira() or is_admin()) then
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
  if not is_admin() and v_created_by is distinct from auth.uid() then
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

create or replace function submit_comanda(p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica', p_bill_id uuid default null)
returns uuid as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_comanda_id uuid;
  v_next_seq int;
  v_next_monthly int;
  v_item jsonb;
  v_after jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object('item', pi.name, 'quantity', i.quantity, 'preco', i.price_snapshot) order by pi.name), '[]'::jsonb)
    into v_after
  from bar_comanda_items i join poolbar_items pi on pi.id = i.poolbar_item_id
  where i.comanda_id = v_comanda_id;
  insert into bar_comanda_history (comanda_id, bill_id, action, actor_id, items_before, items_after)
  values (v_comanda_id, v_bill_id, 'lancada', auth.uid(), null, v_after);

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

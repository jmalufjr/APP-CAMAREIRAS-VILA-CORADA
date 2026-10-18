-- Módulo Contábil — Leva 4: o estoque de bar/frigobar desce no momento
-- do PEDIDO/lançamento, não mais só quando a conta do quarto é paga.
-- Ver PRD_compras&contabil.md seção 26. Mudança de comportamento
-- confirmada explicitamente com o proprietário (PRD_compras&contabil.md
-- seção 22.3 item 4), ciente de que é um sistema em produção.

-- ---------- 1. CATCH-UP: consumo já lançado antes desta migration, em
-- contas ainda não pagas ----------
-- Sem isso, esse consumo nunca seria baixado: o gatilho antigo (baixa só
-- no pagamento) está sendo removido nesta mesma migration, e o novo
-- mecanismo (baixa no pedido) só vale pra lançamentos NOVOS a partir de
-- agora. Mesma lógica de sempre (ficha técnica via inventory_item_recipes),
-- só que rodando uma vez só, pra tudo que já existe, como se tivesse
-- acabado de acontecer. Bills já 'paga' NÃO entram aqui — já foram
-- corretamente baixadas no pagamento, sob o mecanismo antigo.
insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
select r.inventory_item_id, 'baixa_consumo_hospede',
  -(mbi.quantity * r.portions_count * r.amount_per_portion), mbi.bill_id,
  'Baixa de transição — Módulo Contábil Leva 4 (frigobar já lançado antes da mudança)'
from room_bill_minibar_items mbi
join room_bills b on b.id = mbi.bill_id and b.status <> 'paga'
join inventory_item_recipes r on r.minibar_item_id = mbi.minibar_item_id
where mbi.quantity > 0;

insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
select r.inventory_item_id, 'baixa_consumo_hospede',
  -sum(bci.quantity * r.portions_count * r.amount_per_portion), bc.bill_id,
  'Baixa de transição — Módulo Contábil Leva 4 (comanda já lançada antes da mudança)'
from bar_comanda_items bci
join bar_comandas bc on bc.id = bci.comanda_id
join room_bills b on b.id = bc.bill_id and b.status <> 'paga'
join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
where bc.status <> 'cancelada' and bci.quantity > 0
group by r.inventory_item_id, bc.bill_id;

-- ---------- 2. Remove o mecanismo antigo (baixa no pagamento) ----------
drop trigger if exists room_bills_deduct_inventory on room_bills;
drop function if exists deduct_inventory_on_bill_payment();

-- ---------- 3. Frigobar: baixa/estorno atômico no momento do lançamento ----------
-- Substitui o upsert direto que existia em setMinibarConsumption — ler a
-- quantidade antiga, calcular o delta e gravar a nova precisam acontecer
-- juntos, sem brecha pra condição de corrida (duas chamadas concorrentes
-- lendo a mesma quantidade "antiga" ao mesmo tempo). `security definer`
-- igual a toda transição de estado sensível deste schema.
create or replace function set_minibar_consumption(p_bill_id uuid, p_minibar_item_id uuid, p_quantity int)
returns void as $$
declare
  v_bill_status room_bill_status;
  v_price numeric;
  v_old_quantity int;
  v_new_quantity int;
  v_delta int;
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'not authorized';
  end if;

  select status into v_bill_status from room_bills where id = p_bill_id for update;
  if v_bill_status is null then
    raise exception 'Conta não encontrada.';
  end if;
  if v_bill_status = 'fechada' then
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

-- ---------- 4. Comandas: baixa no pedido, estorno na edição, baixa/estorno condicional no cancelamento ----------

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

-- Edita uma comanda existente: pode trocar o quarto (e, com ele, a conta e
-- a numeração passam a ser as do novo quarto) e substitui todos os itens
-- pelos informados. Bloqueia se a comanda já foi cancelada, se a conta
-- atual da comanda está fechada ou já foi paga, ou se a conta de destino
-- está fechada. Desde o Módulo Contábil Leva 4: estorna o estoque dos
-- itens ANTIGOS antes de apagá-los, e baixa de novo pelos itens NOVOS —
-- o efeito líquido é o delta, igual já acontecia implicitamente com o
-- valor financeiro da comanda.
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

drop function if exists cancel_comanda(uuid);

-- p_ingredients_recovered: desde o Módulo Contábil Leva 4, deixou de ser
-- opcional perguntar isso ao cancelar (PRD_compras&contabil.md seção
-- 22.3 item 4) — o estoque já foi baixado no momento do pedido, então
-- cancelar precisa decidir explicitamente se ele volta (true, prato não
-- chegou a ser preparado) ou fica baixado (false, já foi preparado/
-- perdido). Só restaura na primeira vez que a comanda é de fato
-- cancelada (uma chamada redundante numa já cancelada não restaura de
-- novo).
create or replace function cancel_comanda(p_comanda_id uuid, p_ingredients_recovered boolean)
returns void as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_old_status comanda_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select c.bill_id, c.status, b.status into v_bill_id, v_old_status, v_bill_status
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
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

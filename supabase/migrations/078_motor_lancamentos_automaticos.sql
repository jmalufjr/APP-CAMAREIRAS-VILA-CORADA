-- 078: motor de lançamentos automáticos (partidas dobradas) para TODO fato
-- contábil — compra/despesa (já existia, agora com item e café), consumo de
-- bar/frigobar (custo no estoque + receita no fechamento da conta +
-- recebimento no pagamento), baixa manual e ajuste de inventário. Tudo por
-- gatilho no banco, pra nenhum ponto de escrita poder esquecer.

-- ---------- Item de custo em cada linha do livro ----------
alter table ledger_entry_lines add column if not exists cost_item_id uuid references cost_items(id) on delete set null;
create index if not exists ledger_entry_lines_cost_item_idx on ledger_entry_lines (cost_item_id);

-- Núcleo do lançamento (sem checagem de usuário — usado por gatilhos).
create or replace function post_ledger_entry_core(
  p_entry_date date,
  p_document_date date,
  p_cash_date date,
  p_description text,
  p_origin text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb,
  p_created_by uuid
) returns uuid as $$
declare
  v_entry_id uuid;
  v_total_debito numeric := 0;
  v_total_credito numeric := 0;
  v_line jsonb;
  v_line_count int;
begin
  select count(*) into v_line_count from jsonb_array_elements(p_lines);
  if v_line_count < 2 then
    raise exception 'Um lançamento precisa de pelo menos 2 linhas (1 débito e 1 crédito).';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if (v_line->>'direction') = 'debito' then
      v_total_debito := v_total_debito + (v_line->>'amount')::numeric;
    elsif (v_line->>'direction') = 'credito' then
      v_total_credito := v_total_credito + (v_line->>'amount')::numeric;
    else
      raise exception 'direction inválida: %', v_line->>'direction';
    end if;
  end loop;

  if abs(v_total_debito - v_total_credito) > 0.01 then
    raise exception 'Lançamento desbalanceado: débitos % ≠ créditos %', v_total_debito, v_total_credito;
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, created_by)
  values (p_entry_date, p_document_date, p_cash_date, p_description, p_origin, p_source_type, p_source_id, p_created_by)
  returning id into v_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, cost_item_id, direction, amount)
  select
    v_entry_id,
    la.id,
    nullif(elem->>'cost_center_id', '')::uuid,
    nullif(elem->>'cost_item_id', '')::uuid,
    (elem->>'direction')::ledger_entry_direction,
    (elem->>'amount')::numeric
  from jsonb_array_elements(p_lines) elem
  join ledger_accounts la on la.code = (elem->>'account_code');

  if (select count(*) from jsonb_array_elements(p_lines)) <> (select count(*) from ledger_entry_lines where entry_id = v_entry_id) then
    raise exception 'Uma ou mais contas (account_code) não foram encontradas no plano de contas.';
  end if;

  return v_entry_id;
end;
$$ language plpgsql security definer;
revoke execute on function post_ledger_entry_core(date, date, date, text, text, text, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function post_ledger_entry(
  p_entry_date date,
  p_document_date date,
  p_cash_date date,
  p_description text,
  p_origin text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb
) returns uuid as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  return post_ledger_entry_core(p_entry_date, p_document_date, p_cash_date, p_description, p_origin, p_source_type, p_source_id, p_lines, auth.uid());
end;
$$ language plpgsql security definer;

create or replace function reverse_ledger_entry_core(p_entry_id uuid, p_reason text, p_created_by uuid) returns uuid as $$
declare
  v_new_entry_id uuid;
  v_original ledger_entries%rowtype;
begin
  select * into v_original from ledger_entries where id = p_entry_id;
  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;
  if v_original.status = 'estornado' then
    raise exception 'Este lançamento já foi estornado.';
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, reverses_entry_id, created_by)
  values ((now() at time zone 'America/Sao_Paulo')::date, v_original.document_date, v_original.cash_date, coalesce(p_reason, 'Estorno de: ' || v_original.description), 'estorno', v_original.source_type, v_original.source_id, p_entry_id, p_created_by)
  returning id into v_new_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, cost_item_id, direction, amount)
  select v_new_entry_id, l.account_id, l.cost_center_id, l.cost_item_id,
    (case when l.direction = 'debito' then 'credito' else 'debito' end)::ledger_entry_direction, l.amount
  from ledger_entry_lines l
  where l.entry_id = p_entry_id;

  update ledger_entries set status = 'estornado' where id = p_entry_id;
  return v_new_entry_id;
end;
$$ language plpgsql security definer;
revoke execute on function reverse_ledger_entry_core(uuid, text, uuid) from public, anon, authenticated;

create or replace function reverse_ledger_entry(p_entry_id uuid, p_reason text) returns uuid as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  return reverse_ledger_entry_core(p_entry_id, p_reason, auth.uid());
end;
$$ language plpgsql security definer;

-- ---------- Colunas novas ----------
-- Destino do consumo/baixa: centro de custo onde o ativo foi consumido.
alter table inventory_movements add column if not exists consumption_center_id uuid references cost_centers(id) on delete set null;
-- Baixa manual por perda/quebra (vai pra "Perdas e desperdícios") em vez de consumo.
alter table inventory_movements add column if not exists is_loss boolean not null default false;
-- Linha de compra destinada ao café da manhã: custo reconhecido na compra, não entra no estoque.
alter table expense_items add column if not exists for_breakfast boolean not null default false;
-- Rateio próprio desta linha de despesa (substitui o rateio padrão do item de custo): [{center_id, alloc_pct}].
alter table expense_items add column if not exists center_split jsonb;

-- Gatilho BEFORE: carimba o centro de consumo vindo das funções de bar/frigobar.
create or replace function set_movement_consumption_center() returns trigger as $$
declare
  v_name text;
begin
  if new.consumption_center_id is null and new.movement_type = 'baixa_consumo_hospede' then
    v_name := nullif(current_setting('app.consumption_center', true), '');
    if v_name is not null then
      select id into new.consumption_center_id from cost_centers where name = v_name;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists inventory_movements_consumption_center on inventory_movements;
create trigger inventory_movements_consumption_center
before insert on inventory_movements
for each row execute function set_movement_consumption_center();

-- ---------- Lançamento automático de cada movimento de estoque ----------
create or replace function post_inventory_movement_ledger() returns trigger as $$
declare
  v_cost_item_id uuid;
  v_ledger_code text;
  v_stock_account text;
  v_counter text;
  v_center uuid;
  v_center_name text;
  v_value numeric;
  v_item_name text;
  v_origin text;
  v_desc text;
  v_date date;
  v_lines jsonb;
begin
  if new.movement_type = 'compra' then
    return new;
  end if;
  v_value := round(abs(new.total_value), 2);
  if v_value <= 0 then
    return new;
  end if;

  select ci.id, ci.ledger_account_code into v_cost_item_id, v_ledger_code
  from cost_items ci where ci.inventory_item_id = new.inventory_item_id limit 1;
  v_stock_account := coalesce(v_ledger_code, 'estoque-outros');
  select name into v_item_name from inventory_items where id = new.inventory_item_id;
  v_date := (new.created_at at time zone 'America/Sao_Paulo')::date;
  v_center := new.consumption_center_id;
  select name into v_center_name from cost_centers where id = v_center;

  if new.movement_type = 'baixa_consumo_hospede' then
    v_origin := 'consumo';
    v_desc := case when new.total_value < 0 then 'Consumo de ' else 'Estorno de consumo de ' end
      || coalesce(lower(v_center_name), 'bar/frigobar') || ' — ' || coalesce(v_item_name, 'item');
    if v_center_name = 'Frigobar' then
      v_counter := 'cmv-bebidas-frigobar';
    else
      v_counter := case v_stock_account
        when 'estoque-bebidas' then 'cmv-bebidas-bar'
        when 'estoque-alimentos' then 'custo-petiscos-bar'
        else 'custo-drinks-bar' end;
    end if;
  elsif new.movement_type = 'baixa_manual' then
    v_origin := 'baixa-manual';
    if new.is_loss then
      v_desc := 'Perda/quebra de estoque — ' || coalesce(v_item_name, 'item');
      v_counter := 'perdas-estoque';
    else
      v_desc := 'Baixa manual de estoque — ' || coalesce(v_item_name, 'item') || coalesce(' (' || v_center_name || ')', '');
      v_counter := case v_center_name
        when 'Café da manhã' then 'custo-cafe-manha'
        when 'Frigobar' then 'cmv-bebidas-frigobar'
        when 'Hospedagem' then 'materiais-limpeza-hospedagem'
        when 'Administração e áreas comuns' then 'material-administrativo'
        when 'Bar de piscina' then (case v_stock_account
          when 'estoque-bebidas' then 'cmv-bebidas-bar'
          when 'estoque-alimentos' then 'custo-petiscos-bar'
          else 'custo-drinks-bar' end)
        else 'perdas-estoque' end;
    end if;
  elsif new.movement_type = 'ajuste_contagem' then
    v_origin := 'inventario';
    v_desc := case when new.total_value < 0 then 'Ajuste de inventário (falta) — ' else 'Ajuste de inventário (sobra) — ' end || coalesce(v_item_name, 'item');
    v_counter := 'perdas-estoque';
  else
    return new;
  end if;

  -- Perdas/ajustes sem destino explícito: usa o centro principal do item.
  if v_center is null and v_cost_item_id is not null then
    select center_id into v_center from cost_item_centers where cost_item_id = v_cost_item_id order by alloc_pct desc limit 1;
  end if;

  if new.total_value < 0 then
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', v_counter, 'cost_center_id', v_center, 'cost_item_id', v_cost_item_id, 'direction', 'debito', 'amount', v_value),
      jsonb_build_object('account_code', v_stock_account, 'cost_center_id', null, 'cost_item_id', v_cost_item_id, 'direction', 'credito', 'amount', v_value));
  else
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', v_stock_account, 'cost_center_id', null, 'cost_item_id', v_cost_item_id, 'direction', 'debito', 'amount', v_value),
      jsonb_build_object('account_code', v_counter, 'cost_center_id', v_center, 'cost_item_id', v_cost_item_id, 'direction', 'credito', 'amount', v_value));
  end if;

  perform post_ledger_entry_core(v_date, v_date, null, v_desc, v_origin, 'inventory_movements', new.id, v_lines, new.created_by);
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists inventory_movements_post_ledger on inventory_movements;
create trigger inventory_movements_post_ledger
after insert on inventory_movements
for each row execute function post_inventory_movement_ledger();

-- ---------- Receita do consumo (fechamento) e recebimento (pagamento) ----------
create or replace function post_room_bill_ledger() returns trigger as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_amount numeric;
  v_bar_center uuid;
  v_frigo_center uuid;
  v_bar_total numeric := 0;
  v_service numeric;
  v_rec record;
  v_entry_id uuid;
  v_suite text;
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_cash text;
begin
  if new.status = old.status then
    return new;
  end if;

  select number into v_suite from rooms where id = new.room_id;
  select id into v_bar_center from cost_centers where name = 'Bar de piscina';
  select id into v_frigo_center from cost_centers where name = 'Frigobar';

  if new.status = 'fechada' then
    for v_rec in
      select
        case
          when pi.category = 'Petiscos' then 'receita-petiscos-bar'
          when lower(pi.name) in ('água com gás', 'água sem gás', 'água de coco', 'café expresso', 'campari', 'cerveja', 'refrigerante') then 'receita-bebidas-bar'
          else 'receita-drinks-bar'
        end as account_code,
        sum(bci.quantity * bci.price_snapshot) as amount
      from bar_comanda_items bci
      join bar_comandas c on c.id = bci.comanda_id
      join poolbar_items pi on pi.id = bci.poolbar_item_id
      where c.bill_id = new.id and c.status <> 'cancelada' and bci.quantity > 0
      group by 1
    loop
      v_amount := round(v_rec.amount, 2);
      if v_amount > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', v_rec.account_code, 'cost_center_id', v_bar_center, 'direction', 'credito', 'amount', v_amount));
        v_total := v_total + v_amount;
        v_bar_total := v_bar_total + v_amount;
      end if;
    end loop;

    select round(coalesce(sum(quantity * price_snapshot), 0), 2) into v_amount from room_bill_minibar_items where bill_id = new.id;
    if v_amount > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', 'receita-bebidas-frigobar', 'cost_center_id', v_frigo_center, 'direction', 'credito', 'amount', v_amount));
      v_total := v_total + v_amount;
    end if;

    if v_bar_total > 0 and not coalesce(new.service_charge_waived, false) then
      v_service := round(v_bar_total * 0.10, 2);
      if v_service > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', 'salarios-a-pagar', 'cost_center_id', null, 'direction', 'credito', 'amount', v_service));
        v_total := v_total + v_service;
      end if;
    end if;

    if v_total > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', 'consumos-a-liquidar', 'cost_center_id', null, 'direction', 'debito', 'amount', v_total));
      perform post_ledger_entry_core(v_date, v_date, null, 'Consumo de bar/frigobar — suíte ' || coalesce(v_suite, '?') || ' (conta fechada)', 'consumo-fechamento', 'room_bills', new.id, v_lines, null);
    end if;

  elsif old.status = 'fechada' and new.status = 'reaberta' then
    for v_entry_id in
      select id from ledger_entries where source_type = 'room_bills' and source_id = new.id and origin = 'consumo-fechamento' and status = 'confirmado'
    loop
      perform reverse_ledger_entry_core(v_entry_id, 'Conta reaberta — estorno da receita do consumo (suíte ' || coalesce(v_suite, '?') || ')', null);
    end loop;

  elsif new.status = 'paga' then
    select coalesce(sum(l.amount), 0) into v_total
    from ledger_entries e
    join ledger_entry_lines l on l.entry_id = e.id
    join ledger_accounts a on a.id = l.account_id
    where e.source_type = 'room_bills' and e.source_id = new.id and e.origin = 'consumo-fechamento'
      and e.status = 'confirmado' and a.code = 'consumos-a-liquidar' and l.direction = 'debito';
    if v_total > 0 then
      v_cash := case when new.payment_method = 'dinheiro' then 'caixa' else 'banco' end;
      perform post_ledger_entry_core(v_date, v_date, v_date,
        'Recebimento do consumo — suíte ' || coalesce(v_suite, '?') || coalesce(' (' || new.payment_method::text || ')', ''),
        'recebimento', 'room_bills', new.id,
        jsonb_build_array(
          jsonb_build_object('account_code', v_cash, 'cost_center_id', null, 'direction', 'debito', 'amount', v_total),
          jsonb_build_object('account_code', 'consumos-a-liquidar', 'cost_center_id', null, 'direction', 'credito', 'amount', v_total)),
        null);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists room_bills_post_ledger on room_bills;
create trigger room_bills_post_ledger
after update of status on room_bills
for each row execute function post_room_bill_ledger();

-- ---------- Funções que baixam estoque, agora carimbando o centro de consumo ----------
create or replace function create_movement_from_expense_item() returns trigger as $$
declare
  v_inventory_item_id uuid;
begin
  if new.cost_item_id is not null then
    select inventory_item_id into v_inventory_item_id from cost_items where id = new.cost_item_id;
    if v_inventory_item_id is not null and not new.for_breakfast then
      insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_expense_item_id, created_by)
      values (
        v_inventory_item_id,
        'compra',
        new.quantity,
        new.id,
        (select created_by from expenses where id = new.expense_id)
      );

      update purchase_requests
      set status = 'atendido', updated_at = now()
      where inventory_item_id = v_inventory_item_id and status = 'pendente';
    end if;
  end if;
  return new;
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
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

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
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

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
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Frigobar', true);

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

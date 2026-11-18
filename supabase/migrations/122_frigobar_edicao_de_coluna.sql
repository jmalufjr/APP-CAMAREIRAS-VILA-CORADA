-- Frigobar: cada coluna do consumo fica gravada (total = soma das colunas), edicao direta por coluna com
-- historico e lancamento adicional com a conta fechada. So contas nao pagas sao convertidas.
-- Pre-requisito: 121.

alter table minibar_launches add column if not exists column_key text;

-- Chave da coluna de um lancamento: 's:<servico>', 'a:<dia>' (adicional) ou 'prior' (antes do registro por dia).
create or replace function minibar_launch_key(p_source text, p_task_id uuid, p_launched_on date, p_column_key text)
returns text language sql immutable as $$
  select case
    when p_column_key is not null then p_column_key
    when p_source = 'servico' and p_task_id is not null then 's:' || p_task_id::text
    when p_source = 'adicional' then 'a:' || p_launched_on::text
    else 'prior'
  end
$$;

create or replace function log_minibar_launch() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d int;
  v_source text := nullif(current_setting('app.minibar_source', true), '');
  v_task text := nullif(current_setting('app.minibar_task', true), '');
  v_col text := nullif(current_setting('app.minibar_column', true), '');
begin
  if tg_op = 'INSERT' then
    d := new.quantity;
  else
    d := new.quantity - old.quantity;
  end if;
  if d <> 0 then
    insert into minibar_launches (bill_id, minibar_item_id, delta, unit_price, source, task_id, column_key)
    values (new.bill_id, new.minibar_item_id, d, new.price_snapshot,
            coalesce(v_source, 'adicional'),
            case when v_source = 'servico' then v_task::uuid else null end,
            v_col);
  end if;
  return new;
end;
$$;

-- Historico das edicoes diretas de coluna.
create table if not exists minibar_edit_history (
  id bigserial primary key,
  bill_id uuid not null references room_bills(id) on delete cascade,
  column_key text not null,
  minibar_item_id uuid not null references minibar_items(id) on delete cascade,
  qty_before int not null,
  qty_after int not null,
  actor_id uuid references profiles(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index if not exists minibar_edit_history_bill_idx on minibar_edit_history(bill_id);
alter table minibar_edit_history enable row level security;
drop policy if exists meh_select on minibar_edit_history;
create policy meh_select on minibar_edit_history for select using (auth.uid() is not null);

-- Conta FECHADA passa a aceitar so os caminhos abaixo (o checklist continua bloqueado).
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
  if v_bill_status = 'fechada' and coalesce(current_setting('app.minibar_allow_closed', true), '') <> 'on' then
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

-- Lancamento adicional: so com a conta fechada, sem reabrir.
create or replace function set_minibar_consumption_closed(p_bill_id uuid, p_minibar_item_id uuid, p_quantity int)
returns void as $$
declare
  v_status room_bill_status;
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'not authorized';
  end if;
  select status into v_status from room_bills where id = p_bill_id;
  if v_status is distinct from 'fechada' then
    raise exception 'O lançamento adicional só vale para conta fechada.';
  end if;
  perform set_config('app.minibar_allow_closed', 'on', true);
  perform set_minibar_consumption(p_bill_id, p_minibar_item_id, p_quantity);
  perform set_config('app.minibar_allow_closed', '', true);
end;
$$ language plpgsql security definer set search_path = public;

-- Valor de CADA coluna do consumo de frigobar fica gravado (o total do item e a soma das colunas).
-- Colunas: 'prior' (ate 14/11), 's:<servico>' e 'a:<dia>' (lancamento adicional).
create table if not exists room_bill_minibar_columns (
  bill_id uuid not null references room_bills(id) on delete cascade,
  column_key text not null,
  minibar_item_id uuid not null references minibar_items(id) on delete cascade,
  quantity int not null check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bill_id, column_key, minibar_item_id)
);
alter table room_bill_minibar_columns enable row level security;
drop policy if exists rbmc_select on room_bill_minibar_columns;
create policy rbmc_select on room_bill_minibar_columns for select using (auth.uid() is not null);

-- Mantem as colunas quando o consumo muda pelos caminhos normais (checklist, correcao, lancamento adicional):
-- o que foi acrescentado/retirado entra na coluna do servico ou do dia. A edicao direta de coluna grava
-- as colunas por conta propria (flag app.minibar_columns_managed) e este gatilho nao interfere.
create or replace function maintain_minibar_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d int;
  v_source text := nullif(current_setting('app.minibar_source', true), '');
  v_task text := nullif(current_setting('app.minibar_task', true), '');
  v_key text;
  v_remaining int;
  r record;
  v_take int;
begin
  if coalesce(current_setting('app.minibar_columns_managed', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    d := new.quantity;
  else
    d := new.quantity - old.quantity;
  end if;
  if d = 0 then
    return new;
  end if;

  if v_source = 'servico' and v_task is not null then
    v_key := 's:' || v_task;
  else
    v_key := 'a:' || ((now() at time zone 'America/Sao_Paulo')::date)::text;
  end if;

  if d > 0 then
    insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity)
    values (new.bill_id, v_key, new.minibar_item_id, d)
    on conflict (bill_id, column_key, minibar_item_id)
    do update set quantity = room_bill_minibar_columns.quantity + excluded.quantity, updated_at = now();
  else
    v_remaining := -d;
    for r in
      select column_key, quantity from room_bill_minibar_columns
      where bill_id = new.bill_id and minibar_item_id = new.minibar_item_id and quantity > 0
      order by (column_key = v_key) desc, created_at desc
    loop
      exit when v_remaining <= 0;
      v_take := least(r.quantity, v_remaining);
      update room_bill_minibar_columns set quantity = quantity - v_take, updated_at = now()
      where bill_id = new.bill_id and minibar_item_id = new.minibar_item_id and column_key = r.column_key;
      v_remaining := v_remaining - v_take;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists room_bill_minibar_items_columns on room_bill_minibar_items;
create trigger room_bill_minibar_items_columns
  after insert or update on room_bill_minibar_items
  for each row execute function maintain_minibar_columns();

-- Edita uma coluna (aberta, reaberta ou fechada; nunca paga). O valor novo da coluna fica gravado e o total
-- do item passa a ser a soma das colunas. O lancamento original do servico (daily_room_task_minibar_items)
-- nao muda. p_changes = [{"item_id": "...", "quantity": N}].
create or replace function edit_minibar_column(p_bill_id uuid, p_column_key text, p_changes jsonb)
returns void as $$
declare
  v_status room_bill_status;
  v_ch jsonb;
  v_item uuid;
  v_new int;
  v_old int;
  v_total int;
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'not authorized';
  end if;
  select status into v_status from room_bills where id = p_bill_id for update;
  if v_status is null then
    raise exception 'Conta não encontrada.';
  end if;
  if v_status = 'paga' then
    raise exception 'Conta paga não pode ser alterada.';
  end if;

  perform set_config('app.minibar_allow_closed', 'on', true);
  perform set_config('app.minibar_columns_managed', 'on', true);
  perform set_config('app.minibar_source', 'edicao', true);
  perform set_config('app.minibar_column', p_column_key, true);

  for v_ch in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb))
  loop
    v_item := (v_ch->>'item_id')::uuid;
    v_new := coalesce((v_ch->>'quantity')::int, 0);
    if v_new < 0 then
      raise exception 'Quantidade inválida.';
    end if;

    select quantity into v_old from room_bill_minibar_columns
    where bill_id = p_bill_id and column_key = p_column_key and minibar_item_id = v_item;
    v_old := coalesce(v_old, 0);
    if v_new = v_old then
      continue;
    end if;

    insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity)
    values (p_bill_id, p_column_key, v_item, v_new)
    on conflict (bill_id, column_key, minibar_item_id)
    do update set quantity = excluded.quantity, updated_at = now();

    select coalesce(sum(quantity), 0) into v_total from room_bill_minibar_columns
    where bill_id = p_bill_id and minibar_item_id = v_item;
    perform set_minibar_consumption(p_bill_id, v_item, v_total);

    insert into minibar_edit_history (bill_id, column_key, minibar_item_id, qty_before, qty_after, actor_id)
    values (p_bill_id, p_column_key, v_item, v_old, v_new, auth.uid());
  end loop;

  perform set_config('app.minibar_allow_closed', '', true);
  perform set_config('app.minibar_columns_managed', '', true);
  perform set_config('app.minibar_source', '', true);
  perform set_config('app.minibar_column', '', true);
end;
$$ language plpgsql security definer set search_path = public;

-- Conversao das contas AINDA NAO PAGAS: cada uma passa a ter as colunas gravadas (a partir do registro
-- de lancamentos). Contas pagas nao sao tocadas. O que nao tem data entra em 'prior' (Ate 14/11).
do $$
declare
  rec record;
  g record;
  v_cur int;
  v_pos int;
  v_prior int;
  v_deficit int;
  v_take int;
begin
  for rec in
    select r.bill_id, r.minibar_item_id, r.quantity
    from room_bill_minibar_items r
    join room_bills b on b.id = r.bill_id
    where b.status <> 'paga' and r.quantity > 0
      and not exists (select 1 from room_bill_minibar_columns c where c.bill_id = r.bill_id)
  loop
    v_cur := rec.quantity;
    select coalesce(sum(s), 0) into v_pos from (
      select sum(delta) as s
      from minibar_launches
      where bill_id = rec.bill_id and minibar_item_id = rec.minibar_item_id and source is not null
        and minibar_launch_key(source, task_id, launched_on, column_key) <> 'prior'
      group by minibar_launch_key(source, task_id, launched_on, column_key)
      having sum(delta) > 0
    ) x;
    v_prior := v_cur - v_pos;
    v_deficit := 0;
    if v_prior < 0 then
      v_deficit := -v_prior;
      v_prior := 0;
    end if;
    if v_prior > 0 then
      insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity, created_at)
      values (rec.bill_id, 'prior', rec.minibar_item_id, v_prior, 'epoch');
    end if;
    for g in
      select minibar_launch_key(source, task_id, launched_on, column_key) as k, sum(delta) as s, min(created_at) as first_at
      from minibar_launches
      where bill_id = rec.bill_id and minibar_item_id = rec.minibar_item_id and source is not null
        and minibar_launch_key(source, task_id, launched_on, column_key) <> 'prior'
      group by minibar_launch_key(source, task_id, launched_on, column_key)
      having sum(delta) > 0
      order by min(created_at) desc
    loop
      v_take := least(g.s, v_deficit);
      v_deficit := v_deficit - v_take;
      if g.s - v_take > 0 then
        insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity, created_at)
        values (rec.bill_id, g.k, rec.minibar_item_id, g.s - v_take, g.first_at);
      end if;
    end loop;
  end loop;
end $$;

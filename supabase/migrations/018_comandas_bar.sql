-- Passa o controle de consumo do bar da piscina a funcionar por comandas:
-- a camareira registra um pedido (comanda) por quarto, que fica visível
-- numa lista até a conta daquele quarto ser paga. O total de bar por
-- quarto (usado em "Consumo por quartos") passa a ser somado a partir das
-- comandas ativas, não mais de um valor editado diretamente por item —
-- por isso room_bill_poolbar_items (migration 016) é substituída por
-- bar_comandas/bar_comanda_items.
--
-- Fechar/reabrir/marcar como paga a conta do quarto deixa de ser ação do
-- admin e passa a ser da camareira (funções novas abaixo, checando
-- is_camareira() em vez de is_admin()); a policy "rb_admin_all" continua
-- existindo só como acesso de suporte do admin, não é mais o caminho usado
-- pela tela.

drop table room_bill_poolbar_items;

create type comanda_status as enum ('original', 'cancelada', 'editada');

-- Helper: é a camareira autenticada (mesmo padrão de is_admin()/is_manutencao()).
create or replace function is_camareira() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'camareira' and active = true
  );
$$ language sql security definer stable;

-- Uma comanda pertence sempre à conta corrente (room_bills) do quarto no
-- momento em que foi criada/editada; a numeração (sequence_number) é por
-- conta (bill_id), reiniciando em 1 sempre que uma conta nova nasce (ao
-- pagar a anterior).
create table bar_comandas (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  bill_id uuid not null references room_bills(id) on delete cascade,
  sequence_number int not null,
  status comanda_status not null default 'original',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_action_by uuid references profiles(id) on delete set null,
  last_action_at timestamptz not null default now(),
  unique (bill_id, sequence_number)
);

create table bar_comanda_items (
  id uuid primary key default uuid_generate_v4(),
  comanda_id uuid not null references bar_comandas(id) on delete cascade,
  poolbar_item_id uuid not null references poolbar_items(id) on delete cascade,
  quantity int not null check (quantity > 0),
  price_snapshot numeric(10,2) not null,
  unique (comanda_id, poolbar_item_id)
);

alter table bar_comandas enable row level security;
alter table bar_comanda_items enable row level security;

-- Leitura: qualquer autenticado (admin e camareira veem a mesma lista).
-- Escrita: só via funções security definer abaixo (nunca INSERT/UPDATE
-- direto pela camareira) — mesmo padrão de select_occurrence/resolve_occurrence.
create policy "bc_select_authenticated" on bar_comandas for select using (auth.uid() is not null);
create policy "bc_admin_all" on bar_comandas for all using (is_admin()) with check (is_admin());

create policy "bci_select_authenticated" on bar_comanda_items for select using (auth.uid() is not null);
create policy "bci_admin_all" on bar_comanda_items for all using (is_admin()) with check (is_admin());

-- Cria uma comanda nova para o quarto informado, na conta corrente dele.
-- p_items: jsonb tipo [{"item_id": "uuid", "quantity": 2}, ...] (itens com
-- quantidade 0 são ignorados). Bloqueia se a conta do quarto está fechada.
create or replace function submit_comanda(p_room_id uuid, p_items jsonb)
returns uuid as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_comanda_id uuid;
  v_next_seq int;
  v_item jsonb;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_bill_status
  from room_bills where room_id = p_room_id and status <> 'paga'
  for update;

  if v_bill_id is null then
    insert into room_bills (room_id, status) values (p_room_id, 'aberta')
    returning id, status into v_bill_id, v_bill_status;
  end if;

  if v_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  select coalesce(max(sequence_number), 0) + 1 into v_next_seq
  from bar_comandas where bill_id = v_bill_id;

  insert into bar_comandas (room_id, bill_id, sequence_number, status, created_by, last_action_by)
  values (p_room_id, v_bill_id, v_next_seq, 'original', auth.uid(), auth.uid())
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

-- Edita uma comanda existente: pode trocar o quarto (e, com ele, a conta e
-- a numeração passam a ser as do novo quarto) e substitui todos os itens
-- pelos informados. Bloqueia se a comanda já foi cancelada, ou se a conta
-- de destino está fechada.
create or replace function edit_comanda(p_comanda_id uuid, p_room_id uuid, p_items jsonb)
returns void as $$
declare
  v_old_bill_id uuid;
  v_old_status comanda_status;
  v_old_seq int;
  v_new_bill_id uuid;
  v_new_bill_status room_bill_status;
  v_next_seq int;
  v_item jsonb;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select bill_id, status, sequence_number into v_old_bill_id, v_old_status, v_old_seq
  from bar_comandas where id = p_comanda_id
  for update;

  if v_old_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_old_status = 'cancelada' then
    raise exception 'Comanda cancelada não pode ser editada.';
  end if;

  select id, status into v_new_bill_id, v_new_bill_status
  from room_bills where room_id = p_room_id and status <> 'paga'
  for update;

  if v_new_bill_id is null then
    insert into room_bills (room_id, status) values (p_room_id, 'aberta')
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

create or replace function cancel_comanda(p_comanda_id uuid)
returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  update bar_comandas
  set status = 'cancelada', last_action_by = auth.uid(), last_action_at = now()
  where id = p_comanda_id and status <> 'cancelada';
end;
$$ language plpgsql security definer;

-- Fechar/reabrir/marcar como paga a conta do quarto: agora ação da
-- camareira (antes era do admin). Mesma lógica de antes, só a checagem de
-- papel muda.
create or replace function close_room_bill(p_room_id uuid)
returns void as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_status from room_bills where room_id = p_room_id and status <> 'paga' for update;
  if v_bill_id is null then
    insert into room_bills (room_id, status) values (p_room_id, 'aberta') returning id, status into v_bill_id, v_status;
  end if;
  if v_status = 'fechada' then
    raise exception 'A conta deste quarto já está fechada.';
  end if;

  update room_bills set status = 'fechada', closed_at = now(), closed_by = auth.uid() where id = v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function reopen_room_bill(p_room_id uuid)
returns void as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_status from room_bills where room_id = p_room_id and status <> 'paga' for update;
  if v_status is distinct from 'fechada' then
    raise exception 'Só é possível reabrir uma conta fechada.';
  end if;

  update room_bills set status = 'reaberta', reopened_at = now(), reopened_by = auth.uid() where id = v_bill_id;
end;
$$ language plpgsql security definer;

create or replace function pay_room_bill(p_room_id uuid)
returns void as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_status from room_bills where room_id = p_room_id and status <> 'paga' for update;
  if v_status is distinct from 'fechada' then
    raise exception 'Feche a conta antes de registrar o pagamento.';
  end if;

  update room_bills set status = 'paga', paid_at = now(), paid_by = auth.uid() where id = v_bill_id;
  insert into room_bills (room_id, status) values (p_room_id, 'aberta');
end;
$$ language plpgsql security definer;

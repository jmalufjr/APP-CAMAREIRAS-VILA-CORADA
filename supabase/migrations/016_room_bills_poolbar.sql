-- Unifica frigobar e bar da piscina num único ciclo de "conta" por quarto:
-- aberta -> fechada -> (reaberta -> fechada ...) -> paga. Substitui o modelo
-- anterior de frigobar por período de datas (migration 015), que só tinha
-- dados de teste (limpos abaixo) — a partir daqui o consumo (frigobar e bar
-- da piscina) é sempre lançado contra a conta corrente (não-paga) do quarto,
-- e cada nova conta paga reabre automaticamente uma conta nova ('aberta').
--
-- Consumo deixa de ser vinculado à tarefa/dia (daily_room_task_id) e passa a
-- ser um valor por (conta, item), editável tanto pela camareira quanto pelo
-- admin (quando a conta está aberta/reaberta) — é isso que permite "somar"
-- lançamentos de qualquer camareira, em qualquer dia, na mesma conta.
--
-- Como consumo não tem mais data própria, histórico/dashboard passam a
-- somar por bill.paid_at (mês/período em que a conta foi PAGA), não mais
-- pela data da tarefa.

truncate table daily_room_task_minibar;
drop table daily_room_task_minibar;
drop table minibar_bills;

create type room_bill_status as enum ('aberta', 'fechada', 'reaberta', 'paga');

create table room_bills (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  status room_bill_status not null default 'aberta',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references profiles(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references profiles(id) on delete set null
);

-- Cada quarto tem no máximo 1 conta não-paga por vez (a conta corrente).
create unique index room_bills_one_active_per_room on room_bills(room_id) where status <> 'paga';

-- ---------- Frigobar: lançamentos por conta ----------
create table room_bill_minibar_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references room_bills(id) on delete cascade,
  minibar_item_id uuid not null references minibar_items(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  price_snapshot numeric(10,2) not null,
  updated_at timestamptz not null default now(),
  unique (bill_id, minibar_item_id)
);

-- ---------- Bar da piscina: catálogo (categorias Petiscos/Bebidas) ----------
create table poolbar_items (
  id uuid primary key default uuid_generate_v4(),
  category text,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Bar da piscina: lançamentos por conta ----------
create table room_bill_poolbar_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references room_bills(id) on delete cascade,
  poolbar_item_id uuid not null references poolbar_items(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  price_snapshot numeric(10,2) not null,
  updated_at timestamptz not null default now(),
  unique (bill_id, poolbar_item_id)
);

insert into poolbar_items (category, name, price, position) values
  ('Petiscos', 'Bolinho de Bacalhau (10un)', 60.00, 1),
  ('Petiscos', 'Pastel Camarão (6un)', 55.00, 2),
  ('Petiscos', 'Pastel de Queijo (6un)', 50.00, 3),
  ('Petiscos', 'Caldo de Camarão', 45.00, 4),
  ('Petiscos', 'Camarão Alho Óleo c/Macaxeira', 90.00, 5),
  ('Petiscos', 'Macaxeira frita', 30.00, 6),
  ('Petiscos', 'Camarão frito', 60.00, 7),
  ('Petiscos', 'Filé Camarão c/Macaxeira', 110.00, 8),
  ('Petiscos', 'Filé Mignon trinchado c/Macaxeira', 85.00, 9),
  ('Petiscos', 'Salada trivial (Folhas/Tomate/Cebola/Ovos/Palmito)', 60.00, 10),
  ('Petiscos', 'Americano (Pão forma/Presunto/Queijo/Ovo/Salada)', 30.00, 11),
  ('Bebidas', 'Caipirinha', 25.00, 12),
  ('Bebidas', 'Caipiroska Smirnoff', 35.00, 13),
  ('Bebidas', 'Caipiroska Absolut', 45.00, 14),
  ('Bebidas', 'Caipifruta Cachaça', 30.00, 15),
  ('Bebidas', 'Caipifruta Smirnoff', 40.00, 16),
  ('Bebidas', 'Gim Tônica à moda da casa (Tanqueray)', 50.00, 17),
  ('Bebidas', 'Campari', 15.00, 18),
  ('Bebidas', 'Água de Coco', 8.00, 19);

-- Toda tarefa administrativa (deletar/criar quartos) mantém invariante de
-- exatamente 1 conta não-paga por quarto ativo.
insert into room_bills (room_id, status) select id, 'aberta' from rooms;

alter table room_bills enable row level security;
alter table room_bill_minibar_items enable row level security;
alter table poolbar_items enable row level security;
alter table room_bill_poolbar_items enable row level security;

-- room_bills: todo autenticado lê (camareira precisa saber se a conta está
-- fechada/reaberta); só admin muda o status (fechar/reabrir/pagar).
create policy "rb_select_authenticated" on room_bills for select using (auth.uid() is not null);
create policy "rb_admin_all" on room_bills for all using (is_admin()) with check (is_admin());

-- room_bill_minibar_items: admin sempre pode; camareira só quando a conta
-- corrente do quarto está aberta ou reaberta (bloqueada quando fechada).
create policy "rbmi_select_authenticated" on room_bill_minibar_items for select using (auth.uid() is not null);
create policy "rbmi_admin_all" on room_bill_minibar_items for all using (is_admin()) with check (is_admin());
create policy "rbmi_camareira_insert" on room_bill_minibar_items for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'camareira' and active = true)
    and exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta'))
  );
create policy "rbmi_camareira_update" on room_bill_minibar_items for update
  using (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')))
  with check (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')));

-- poolbar_items: todo autenticado lê; só admin edita
create policy "pbi_select_authenticated" on poolbar_items for select using (auth.uid() is not null);
create policy "pbi_admin_write" on poolbar_items for insert with check (is_admin());
create policy "pbi_admin_update" on poolbar_items for update using (is_admin());
create policy "pbi_admin_delete" on poolbar_items for delete using (is_admin());

-- room_bill_poolbar_items: mesmo padrão do frigobar
create policy "rbpi_select_authenticated" on room_bill_poolbar_items for select using (auth.uid() is not null);
create policy "rbpi_admin_all" on room_bill_poolbar_items for all using (is_admin()) with check (is_admin());
create policy "rbpi_camareira_insert" on room_bill_poolbar_items for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'camareira' and active = true)
    and exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta'))
  );
create policy "rbpi_camareira_update" on room_bill_poolbar_items for update
  using (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')))
  with check (exists (select 1 from room_bills b where b.id = bill_id and b.status in ('aberta', 'reaberta')));

-- Garante (e retorna) a conta não-paga corrente de um quarto, criando-a se
-- ainda não existir. Só admin pode inserir em room_bills via RLS comum, mas
-- qualquer usuário autenticado (inclusive camareira, ao lançar consumo pela
-- primeira vez num quarto novo) precisa conseguir garantir essa conta —
-- daí a função security definer, no mesmo padrão de select_occurrence etc.
create or replace function ensure_room_bill(p_room_id uuid)
returns room_bills as $$
declare
  v_bill room_bills;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_bill from room_bills where room_id = p_room_id and status <> 'paga' limit 1;
  if v_bill.id is not null then
    return v_bill;
  end if;

  insert into room_bills (room_id, status) values (p_room_id, 'aberta') returning * into v_bill;
  return v_bill;
end;
$$ language plpgsql security definer;

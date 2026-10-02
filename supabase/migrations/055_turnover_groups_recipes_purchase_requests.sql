-- Grupos de giro (ciclo de reposição por categoria de controle fino),
-- ficha técnica (ingrediente(s) por produto do cardápio, substituindo o
-- vínculo simples 1-pra-1 que nunca chegou a produção) e pedidos de
-- compra visuais da camareira/manutenção — ver PRD_compras.md pra
-- decisões completas desta leva.

-- ---------- GRUPOS DE GIRO ----------
-- coverage_days: "dias de folga" daquele grupo — editável pelo admin a
-- qualquer momento. Usado pra calcular o ponto de reposição automático
-- (giro médio semanal × dias de folga ÷ 7).
create table inventory_turnover_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  coverage_days int not null check (coverage_days > 0),
  created_at timestamptz not null default now()
);

alter table inventory_turnover_groups enable row level security;
create policy "inv_turnover_groups_select_authenticated" on inventory_turnover_groups
  for select using (auth.uid() is not null);
create policy "inv_turnover_groups_admin_write" on inventory_turnover_groups
  for all using (is_admin()) with check (is_admin());

insert into inventory_turnover_groups (name, coverage_days) values
  ('Limpeza', 7),
  ('Bebidas não alcoólicas', 7),
  ('Alimentos (petiscos do bar da piscina)', 7),
  ('Alimentos (café da manhã)', 7),
  ('Bebidas alcoólicas', 60),
  ('Materiais de piscina', 60),
  ('Materiais de manutenção', 30);

-- ---------- NOVOS CAMPOS EM inventory_items ----------
-- turnover_group_id: opcional — de propósito, itens perecíveis (ex.:
-- frutas do café da manhã) nunca recebem grupo, então nunca têm ponto de
-- reposição calculado, só o controle visual via pedidos de compra.
-- portion_weight_kg: só pros itens controlados por "porção" (ex.:
-- macaxeira, camarão, filé mignon) — peso médio de 1 porção em kg,
-- usado só na hora de converter "porções necessárias" em "kg a comprar"
-- na lista de compras; nunca usado pra nada além disso.
alter table inventory_items
  add column turnover_group_id uuid references inventory_turnover_groups(id) on delete set null,
  add column portion_weight_kg numeric(10,4);

-- O vínculo simples 1-pra-1 (linked_minibar_item_id/linked_poolbar_item_id)
-- nunca chegou a produção — removido em favor da ficha técnica abaixo,
-- que cobre tanto o caso simples (1 ingrediente, 1 produto) quanto o caso
-- de ingrediente compartilhado por vários produtos do cardápio (ex.:
-- macaxeira usada em 3 pratos diferentes do bar da piscina).
alter table inventory_items
  drop constraint if exists inventory_items_check,
  drop column if exists linked_minibar_item_id,
  drop column if exists linked_poolbar_item_id;

-- ---------- FICHA TÉCNICA (receita): ingrediente(s) por produto do cardápio ----------
-- Um item de estoque (ingrediente) pode alimentar vários produtos do
-- cardápio (frigobar OU bar da piscina, nunca os dois na mesma linha), e
-- um produto do cardápio pode consumir vários ingredientes — por isso é
-- uma tabela de ligação (muitos-pra-muitos), não mais uma coluna solta.
-- portions_per_order: quantas porções daquele ingrediente um pedido do
-- produto consome (ex.: "filé mignon com macaxeira" pode consumir 1
-- porção de macaxeira por pedido, mas "macaxeira frita" sozinha, 2).
-- O estoque e a lista de compras sempre mostram só o ingrediente, nunca
-- de qual produto ele veio — a origem (frigobar/bar, qual prato) é
-- irrelevante pro controle de estoque, só importa pra saber quanto baixar
-- quando a conta é paga.
create table inventory_item_recipes (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  minibar_item_id uuid references minibar_items(id) on delete cascade,
  poolbar_item_id uuid references poolbar_items(id) on delete cascade,
  portions_per_order numeric(10,3) not null default 1 check (portions_per_order > 0),
  created_at timestamptz not null default now(),
  check (
    (minibar_item_id is not null and poolbar_item_id is null) or
    (minibar_item_id is null and poolbar_item_id is not null)
  )
);
create unique index inv_item_recipes_minibar_uq on inventory_item_recipes (inventory_item_id, minibar_item_id)
  where minibar_item_id is not null;
create unique index inv_item_recipes_poolbar_uq on inventory_item_recipes (inventory_item_id, poolbar_item_id)
  where poolbar_item_id is not null;

alter table inventory_item_recipes enable row level security;
create policy "inv_recipes_select_authenticated" on inventory_item_recipes
  for select using (auth.uid() is not null);
create policy "inv_recipes_admin_write" on inventory_item_recipes
  for all using (is_admin()) with check (is_admin());

-- ---------- PEDIDOS DE COMPRA (sinal visual da camareira/manutenção) ----------
-- Cada pedido é uma linha própria, nunca mesclada com outra — se a mesma
-- pessoa (ou outra) pedir de novo o mesmo item, nasce um pedido novo, e
-- os pendentes se somam na visão do admin (ver getAggregatedPurchaseRequests).
-- Quem pediu pode editar ou cancelar só o próprio pedido, enquanto
-- 'pendente'; o admin só cancela "o total" de um item (todas as linhas
-- pendentes de uma vez, de qualquer pessoa) via função própria abaixo.
create type purchase_request_status as enum ('pendente', 'atendido', 'cancelado');

create table purchase_requests (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  requested_qty numeric(12,3) not null check (requested_qty > 0),
  notes text,
  status purchase_request_status not null default 'pendente',
  requested_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table purchase_requests enable row level security;
create policy "purchase_req_select_own_or_admin" on purchase_requests
  for select using (requested_by = auth.uid() or is_admin());
create policy "purchase_req_insert_own" on purchase_requests
  for insert with check (
    requested_by = auth.uid() and (is_camareira() or is_manutencao() or is_admin())
  );
create policy "purchase_req_update_own_pending" on purchase_requests
  for update using (requested_by = auth.uid() and status = 'pendente')
  with check (requested_by = auth.uid());

-- Cancelamento em massa pelo admin (precisa de security definer porque
-- mexe em linhas de outras pessoas, fora do alcance da policy de update
-- "própria e pendente" acima).
create or replace function cancel_purchase_requests_for_item(p_inventory_item_id uuid) returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update purchase_requests
  set status = 'cancelado', updated_at = now()
  where inventory_item_id = p_inventory_item_id and status = 'pendente';
end;
$$ language plpgsql security definer;

-- ---------- VIEWS: giro semanal e sugestão de compra calculada ----------
-- Giro = consumo real (baixa manual + baixa automática de consumo de
-- hóspede — nunca compra nem ajuste de contagem) dos últimos 60 dias,
-- convertido pra "por semana" só pra ficar mais legível (o cálculo em si
-- continua em cima de dias, não muda nada na precisão).
create view inventory_weekly_turnover
with (security_invoker = true) as
select inventory_item_id,
  (coalesce(sum(-quantity), 0) / 60.0) * 7 as weekly_consumption
from inventory_movements
where movement_type in ('baixa_manual', 'baixa_consumo_hospede')
  and created_at >= now() - interval '60 days'
group by inventory_item_id;

-- Ponto de reposição calculado = giro semanal ÷ 7 × dias de folga do
-- grupo do item — só existe quando o item tem um grupo de giro (itens
-- sem grupo, como frutas perecíveis, ficam com calculated_reorder_point
-- nulo de propósito, nunca 0 — "sem dado" é diferente de "zero", mesma
-- distinção já usada noutras partes do app pra não confundir "não
-- calculado ainda" com "calculado e deu zero").
create view inventory_purchase_suggestions
with (security_invoker = true) as
select
  ii.id as inventory_item_id,
  coalesce(ib.balance, 0) as balance,
  coalesce(wt.weekly_consumption, 0) as weekly_consumption,
  tg.coverage_days,
  case when tg.coverage_days is not null
    then (coalesce(wt.weekly_consumption, 0) / 7.0) * tg.coverage_days
    else null
  end as calculated_reorder_point,
  ii.reorder_point as manual_reorder_point,
  ii.portion_weight_kg
from inventory_items ii
left join inventory_balances ib on ib.inventory_item_id = ii.id
left join inventory_weekly_turnover wt on wt.inventory_item_id = ii.id
left join inventory_turnover_groups tg on tg.id = ii.turnover_group_id
where ii.active;

-- ---------- TRIGGER: compra resolve pedido de compra, além da entrada de estoque ----------
-- Qualquer compra do item resolve TODOS os pedidos pendentes dele,
-- independentemente da quantidade comprada ter sido suficiente ou não —
-- o pedido da equipe é só um sinal visual ("sugestão"), não uma meta a
-- bater. Quem continua refletindo uma compra insuficiente é a sugestão
-- CALCULADA pelo sistema, que é sempre (ponto calculado − saldo atual):
-- como o saldo já sobe com a compra, uma compra insuficiente já aparece
-- sozinha como uma sugestão menor na próxima consulta, sem precisar de
-- nenhum ajuste extra aqui — decorrência direta de nunca persistir esse
-- valor (ver view acima).
create or replace function create_movement_from_expense_item() returns trigger as $$
begin
  if new.inventory_item_id is not null then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_expense_item_id, created_by)
    values (
      new.inventory_item_id,
      'compra',
      new.quantity,
      new.id,
      (select created_by from expenses where id = new.expense_id)
    );

    update purchase_requests
    set status = 'atendido', updated_at = now()
    where inventory_item_id = new.inventory_item_id and status = 'pendente';
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ---------- TRIGGER: baixa automática via ficha técnica (substitui o vínculo 1-pra-1) ----------
-- Mesmo gatilho de antes (dispara só na transição pra 'paga'), reescrito
-- pra somar por TODOS os produtos do cardápio ligados àquele ingrediente
-- via inventory_item_recipes, multiplicando pela quantidade consumida e
-- por portions_per_order — é o que permite macaxeira (ou qualquer
-- ingrediente) ser compartilhada entre vários pratos sem duplicar
-- cadastro nem decisão de "é do frigobar ou do bar".
create or replace function deduct_inventory_on_bill_payment() returns trigger as $$
begin
  if new.status = 'paga' and (old.status is null or old.status is distinct from 'paga') then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -(mbi.quantity * r.portions_per_order), new.id,
      'Baixa automática ao pagar a conta (frigobar)'
    from room_bill_minibar_items mbi
    join inventory_item_recipes r on r.minibar_item_id = mbi.minibar_item_id
    where mbi.bill_id = new.id and mbi.quantity > 0;

    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -sum(bci.quantity * r.portions_per_order), new.id,
      'Baixa automática ao pagar a conta (bar da piscina)'
    from bar_comanda_items bci
    join bar_comandas bc on bc.id = bci.comanda_id
    join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
    where bc.bill_id = new.id and bc.status <> 'cancelada' and bci.quantity > 0
    group by r.inventory_item_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

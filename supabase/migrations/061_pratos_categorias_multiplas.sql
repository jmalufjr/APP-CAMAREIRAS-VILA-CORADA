-- Dupla natureza de consumo (autônomo + ingrediente de prato) e categoria
-- de gasto deixando de ser única por item de estoque — ver PRD_compras.md
-- seção 19 pro raciocínio completo.
--
-- Decisão de arquitetura (confirmada com o proprietário antes de
-- implementar): "prato" não é um catálogo novo e desconectado — é o
-- próprio catálogo já existente de itens vendáveis do bar da
-- piscina/frigobar (poolbar_items/minibar_items). A "Lista de pratos" é
-- só uma tela nova de gestão da ficha técnica (inventory_item_recipes) a
-- partir do prato, em vez de a partir do ingrediente — garante que pedir
-- o prato de verdade já desconta estoque, porque usa o mesmo gatilho que
-- já existe (deduct_inventory_on_bill_payment) e já funciona.

-- 1) Nova categoria "Frigobar" — faltava (só existia "Bar da piscina"),
-- mas o próprio pedido já cita "frigobar" como categoria de um item.
insert into expense_categories (name, is_inventory_category)
select 'Frigobar', true
where not exists (select 1 from expense_categories where name = 'Frigobar');

-- 2) Categoria de gasto deixa de ser 1-pra-1 e passa a ser N-pra-N por
-- item de estoque (ex.: "Coca-Cola Zero lata" pode ser Bar da piscina E
-- Frigobar ao mesmo tempo).
create table inventory_item_categories (
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  category_id uuid not null references expense_categories(id) on delete cascade,
  primary key (inventory_item_id, category_id)
);

insert into inventory_item_categories (inventory_item_id, category_id)
select id, category_id from inventory_items where category_id is not null;

-- A view de histórico de quebra de estoque (Parte 18) dependia de
-- inventory_items.category_id direto — precisa ser trocada pra usar a
-- tabela de ligação ANTES da coluna antiga ser removida (Postgres não
-- deixa derrubar uma coluna que uma view ainda lê). Com mais de uma
-- categoria, mostra todas juntas, separadas por "/".
create or replace view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  coalesce(
    (select string_agg(ec.name, ' / ' order by ec.name)
     from inventory_item_categories iic
     join expense_categories ec on ec.id = iic.category_id
     where iic.inventory_item_id = ii.id),
    '—'
  ) as category_name,
  cl.theoretical_qty,
  cl.counted_qty,
  (cl.counted_qty - cl.theoretical_qty) as diferenca,
  cl.quebra_pct,
  cl.quebra_12m_pct,
  cl.indice_relativo_pct,
  ii.quebra_maxima_admitida_pct,
  ii.indice_relativo_maximo_pct,
  cs.closed_at,
  lag(cs.closed_at) over (partition by cl.inventory_item_id order by cs.closed_at) as previous_count_date
from inventory_count_lines cl
join inventory_count_sessions cs on cs.id = cl.session_id
join inventory_items ii on ii.id = cl.inventory_item_id
where cs.status = 'concluida' and cl.counted_qty is not null;

alter table inventory_items drop column category_id;

alter table inventory_item_categories enable row level security;
create policy "inv_item_categories_select_authenticated" on inventory_item_categories
  for select using (auth.uid() is not null);
create policy "inv_item_categories_insert_admin_manutencao" on inventory_item_categories
  for insert with check (is_admin() or is_manutencao());
create policy "inv_item_categories_delete_admin_manutencao" on inventory_item_categories
  for delete using (is_admin() or is_manutencao());

-- 3) Ficha técnica: "portions_per_order" (um número só, ambíguo) virou
-- dois campos explícitos — quantidade de porções do prato (contagem) ×
-- quantidade do item em 1 porção (na unidade própria do item, ex.: kg,
-- L, un). O total consumido por pedido é portions_count * amount_per_portion.
alter table inventory_item_recipes
  add column portions_count numeric(10,3) not null default 1 check (portions_count > 0),
  add column amount_per_portion numeric(12,4) not null default 0 check (amount_per_portion >= 0);

-- Preserva o total já calculado de qualquer ficha técnica existente
-- (portions_count=1 * amount_per_portion=valor antigo = mesmo total de
-- antes) — nunca zera um dado que já existia, mesma regra já usada no
-- projeto pra mudança de regra de cálculo.
update inventory_item_recipes set amount_per_portion = portions_per_order, portions_count = 1;

alter table inventory_item_recipes drop column portions_per_order;

create or replace function deduct_inventory_on_bill_payment() returns trigger as $$
begin
  if new.status = 'paga' and (old.status is null or old.status is distinct from 'paga') then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -(mbi.quantity * r.portions_count * r.amount_per_portion), new.id,
      'Baixa automática ao pagar a conta (frigobar)'
    from room_bill_minibar_items mbi
    join inventory_item_recipes r on r.minibar_item_id = mbi.minibar_item_id
    where mbi.bill_id = new.id and mbi.quantity > 0;

    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -sum(bci.quantity * r.portions_count * r.amount_per_portion), new.id,
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

-- 4) "Categoria" deixa de ser um campo da compra inteira (uma compra pode
-- ter itens de categorias diferentes) e passa a existir só por item —
-- ver CLAUDE.md/PRD_compras.md pra onde essa informação passa a viver.
alter table expenses drop column category_id;

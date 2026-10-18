-- Limpeza do modelo antigo de "categoria de gasto" (Partes 19/20),
-- totalmente substituído pelo Plano de Contas (migrations 064/065) — ver
-- PRD_compras.md seção 21.

-- 1) A baixa automática de estoque ao lançar uma compra passa a resolver
-- o item de estoque através do item de custo, não mais direto por
-- inventory_item_id (que deixa de existir em expense_items).
create or replace function create_movement_from_expense_item() returns trigger as $$
declare
  v_inventory_item_id uuid;
begin
  if new.cost_item_id is not null then
    select inventory_item_id into v_inventory_item_id from cost_items where id = new.cost_item_id;
    if v_inventory_item_id is not null then
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

-- 2) expense_items perde os campos antigos (já totalmente substituídos
-- por cost_item_id/fixed_asset_id, migration 064, com o backfill dos
-- dados reais já feito na migration 065).
alter table expense_items drop column inventory_item_id;
alter table expense_items drop column category_id;

-- 3) Contagem física passa a ser organizada por GRUPO de subcentros com
-- o mesmo nome (ex.: "Alimentos" junta o subcentro de Café da manhã e o
-- de Bar da piscina numa contagem só) — decisão explícita do
-- proprietário. category_id (ligado a expense_categories) sai;
-- subcenter_group_name (o nome do grupo, não o id de 1 subcentro
-- específico) entra. null continua significando "todos os itens".
alter table inventory_count_sessions add column subcenter_group_name text;
alter table inventory_count_sessions drop column category_id;

-- Frequência de contagem (antes por categoria) passa a ser configurada
-- por subcentro — ao agrupar por nome repetido, a tela usa a menor
-- frequência configurada entre os subcentros daquele grupo.
alter table cost_subcenters add column count_frequency_days int check (count_frequency_days is null or count_frequency_days > 0);

-- Trava de "no máximo 1 sessão em_andamento por vez" (migration 059)
-- agora por grupo de subcentro, não mais por categoria.
create unique index inventory_count_sessions_one_open_per_group
  on inventory_count_sessions (coalesce(subcenter_group_name, ''))
  where status = 'em_andamento';

-- A view de histórico de quebra de estoque (Parte 18/19) mostrava a(s)
-- categoria(s) do item via inventory_item_categories — agora mostra
-- o(s) subcentro(s) a que o item de custo ligado àquele item de estoque
-- pertence, pela mesma ideia.
create or replace view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  coalesce(
    (select string_agg(distinct cs.name, ' / ' order by cs.name)
     from cost_items ci
     join cost_item_subcenters cis on cis.cost_item_id = ci.id
     join cost_subcenters cs on cs.id = cis.subcenter_id
     where ci.inventory_item_id = ii.id),
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
  cs2.closed_at,
  lag(cs2.closed_at) over (partition by cl.inventory_item_id order by cs2.closed_at) as previous_count_date
from inventory_count_lines cl
join inventory_count_sessions cs2 on cs2.id = cl.session_id
join inventory_items ii on ii.id = cl.inventory_item_id
where cs2.status = 'concluida' and cl.counted_qty is not null;

-- 4) inventory_item_categories (N-pra-N item↔categoria, Parte 19) e
-- expense_categories (Partes 1/20) saem por completo — tudo que
-- dependia delas já tem substituto no Plano de Contas.
drop table inventory_item_categories;
drop table expense_categories;

-- 5) Ativo Permanente: categorias passam a ser as 3 do plano de contas
-- do documento (Máquinas, Metais e louças banho, Aparelhos) — as 13
-- antigas nunca tiveram nenhum bem real cadastrado, substituição segura.
delete from asset_categories;
insert into asset_categories (name, position) values
  ('Máquinas', 1),
  ('Metais e louças banho', 2),
  ('Aparelhos', 3);

insert into fixed_asset_catalog_items (name, category_id, position)
select v.name, ac.id, v.pos
from (values
  ('Bombas de piscina', 1), ('Bombas pressurizadoras', 2), ('Bombas de irrigação', 3), ('Bombas de poço', 4),
  ('Boilers', 5), ('Aquecedores Cardal', 6), ('Filtros de piscina', 7), ('Politrizes', 8), ('Maquitas', 9), ('Furadeiras', 10)
) as v(name, pos)
cross join lateral (select id from asset_categories where name = 'Máquinas') ac;

insert into fixed_asset_catalog_items (name, category_id, position)
select v.name, ac.id, v.pos
from (values
  ('Torneiras', 1), ('Chuveiros', 2), ('Vasos sanitários', 3), ('Registros', 4), ('Ralos', 5), ('Pias', 6), ('Espelhos', 7)
) as v(name, pos)
cross join lateral (select id from asset_categories where name = 'Metais e louças banho') ac;

insert into fixed_asset_catalog_items (name, category_id, position)
select v.name, ac.id, v.pos
from (values
  ('Televisores', 1), ('Roteadores', 2), ('Frigobares', 3), ('Refrigeradores', 4), ('Freezers', 5), ('Bebedouros', 6),
  ('Filtros de água', 7), ('Máquinas de café', 8), ('Ar condicionados', 9), ('Máquinas de lavar', 10),
  ('Lavadoras pressurizada', 11), ('Aspiradores de pó', 12), ('Câmeras', 13), ('Controladoras', 14),
  ('Computadores', 15), ('Laptops', 16), ('Impressoras', 17)
) as v(name, pos)
cross join lateral (select id from asset_categories where name = 'Aparelhos') ac;

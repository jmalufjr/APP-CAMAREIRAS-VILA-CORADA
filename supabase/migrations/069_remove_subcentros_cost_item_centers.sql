-- Módulo Contábil — Leva 1 (parte 2): remove a camada de subcentros do
-- Plano de Contas, ligando item de custo direto no centro — decisão
-- tomada explicitamente com o proprietário (PRD_compras&contabil.md
-- seção 22.3, item 2): o rateio por percentual entre centros continua
-- existindo, só sem a camada do meio.
--
-- Um item de custo hoje pode estar em mais de 1 subcentro, e cada
-- subcentro pode estar em mais de 1 centro — o percentual "de verdade"
-- que cada item já tem em cada centro é a MULTIPLICAÇÃO dos dois
-- percentuais, somada quando o mesmo centro é alcançado por mais de um
-- caminho. Essa migration deriva esse percentual combinado a partir do
-- que já existe hoje, arredondando pro inteiro mais próximo e corrigindo
-- a sobra de arredondamento na maior linha de cada item (mesma técnica
-- já usada no seed original da migration 065), garantindo que a soma de
-- cada item continua batendo 100%.

create table cost_item_centers (
  cost_item_id uuid not null references cost_items(id) on delete cascade,
  center_id uuid not null references cost_centers(id) on delete cascade,
  alloc_pct numeric(6,2) not null check (alloc_pct > 0 and alloc_pct <= 100),
  primary key (cost_item_id, center_id)
);

do $$
declare
  r record;
  v_total numeric;
  v_first_center_id uuid;
begin
  for r in
    select cis.cost_item_id, csc.center_id, sum(cis.alloc_pct * csc.alloc_pct / 100.0) as raw_pct
    from cost_item_subcenters cis
    join cost_subcenter_centers csc on csc.subcenter_id = cis.subcenter_id
    group by cis.cost_item_id, csc.center_id
  loop
    insert into cost_item_centers (cost_item_id, center_id, alloc_pct)
    values (r.cost_item_id, r.center_id, round(r.raw_pct))
    on conflict (cost_item_id, center_id) do update set alloc_pct = excluded.alloc_pct;
  end loop;

  -- Corrige a sobra de arredondamento: pra cada item cuja soma não bate
  -- 100 exatamente, ajusta a maior linha dele pra absorver a diferença.
  for r in
    select cost_item_id, sum(alloc_pct) as total
    from cost_item_centers
    group by cost_item_id
    having sum(alloc_pct) <> 100
  loop
    v_total := 100 - r.total;
    select center_id into v_first_center_id
    from cost_item_centers
    where cost_item_id = r.cost_item_id
    order by alloc_pct desc, center_id
    limit 1;

    update cost_item_centers
    set alloc_pct = alloc_pct + v_total
    where cost_item_id = r.cost_item_id and center_id = v_first_center_id;
  end loop;
end $$;

-- Confere que todo item de custo com algum vínculo soma exatamente 100
-- antes de seguir — se isso falhar, a migration para aqui, sem apagar
-- nada do que já existia.
do $$
declare
  v_bad_count int;
begin
  select count(*) into v_bad_count
  from (select cost_item_id from cost_item_centers group by cost_item_id having sum(alloc_pct) <> 100) t;
  if v_bad_count > 0 then
    raise exception 'Encontrados % itens de custo cujo rateio por centro não soma 100%% após a migração — abortando antes de remover os subcentros.', v_bad_count;
  end if;
end $$;

alter table cost_item_centers enable row level security;
create policy "cost_item_centers_select_authenticated" on cost_item_centers for select using (auth.uid() is not null);
create policy "cost_item_centers_admin_write" on cost_item_centers for all using (is_admin()) with check (is_admin());

-- `inventory_count_line_history` usava subcentro pra mostrar a
-- categoria do item — passa a mostrar direto o(s) centro(s).
create or replace view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  coalesce(
    (select string_agg(distinct cc.name, ' / ' order by cc.name)
     from cost_items ci
     join cost_item_centers cic on cic.cost_item_id = ci.id
     join cost_centers cc on cc.id = cic.center_id
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

-- A contagem física agrupada "por nome de subcentro através de centros"
-- (ex.: "Alimentos" juntando Café da manhã e Bar da piscina numa
-- contagem só) deixa de fazer sentido sem subcentro — vira, por ora,
-- agrupada por CENTRO inteiro (granularidade mais grossa; será
-- repensada na Leva 3, ver PRD seção 22.3 item 2). Renomeia a coluna pra
-- não sugerir mais "subcentro", e `count_frequency_days` migra pra
-- `cost_centers` — como um centro podia ter várias frequências
-- diferentes vindas de vários subcentros, não dá pra adivinhar qual
-- vale; começa sempre em branco (sem aviso configurado), o admin
-- reconfigura se quiser.
alter table cost_centers add column count_frequency_days int check (count_frequency_days is null or count_frequency_days > 0);

alter table inventory_count_sessions rename column subcenter_group_name to count_group_name;
drop index inventory_count_sessions_one_open_per_group;
create unique index inventory_count_sessions_one_open_per_group
  on inventory_count_sessions (coalesce(count_group_name, ''))
  where status = 'em_andamento';

drop table cost_item_subcenters;
drop table cost_subcenter_centers;
drop table cost_subcenters;

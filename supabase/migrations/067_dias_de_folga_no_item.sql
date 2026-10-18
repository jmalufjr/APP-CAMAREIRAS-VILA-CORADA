-- "Dias de folga" deixa de ser um grupo de giro separado (tela "Grupos de
-- giro", excluída) e passa a ser um campo direto em cada item de estoque
-- — ver PRD_compras.md seção 21 ("Itens de estoque e ciclo de compras").

alter table inventory_items add column coverage_days int not null default 7 check (coverage_days > 0);

update inventory_items ii
set coverage_days = itg.coverage_days
from inventory_turnover_groups itg
where ii.turnover_group_id = itg.id;

-- A sugestão calculada de compra usava "sem grupo de giro" como forma de
-- excluir itens perecíveis (frutas, ovos de café da manhã) do cálculo
-- automático — esses itens, agora, nem chegam a ser item de estoque (são
-- item de custo sem is_inventory), então a exceção "sem grupo = sem
-- cálculo" não tem mais nenhum caso de uso real; todo item de estoque
-- passa a ter sempre um coverage_days (padrão 7) e sempre um ponto de
-- reposição calculado.
create or replace view inventory_purchase_suggestions
with (security_invoker = true) as
select
  ii.id as inventory_item_id,
  coalesce(ib.balance, 0) as balance,
  coalesce(wt.weekly_consumption, 0) as weekly_consumption,
  ii.coverage_days,
  (coalesce(wt.weekly_consumption, 0) / 7.0) * ii.coverage_days as calculated_reorder_point,
  ii.reorder_point as manual_reorder_point,
  ii.portion_weight_kg
from inventory_items ii
left join inventory_balances ib on ib.inventory_item_id = ii.id
left join inventory_weekly_turnover wt on wt.inventory_item_id = ii.id
where ii.active;

alter table inventory_items drop column turnover_group_id;
drop table inventory_turnover_groups;

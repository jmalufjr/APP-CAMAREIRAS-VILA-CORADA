-- Módulo Contábil — Leva 3: estoque com saldo em R$ (custo médio
-- ponderado móvel), não só quantidade. Ver PRD_compras&contabil.md
-- seção 25.
--
-- Decisão de design: em vez de guardar um "avg_cost" por item que
-- precisaria ser atualizado por código toda vez que um movimento é
-- inserido (risco real de esquecer um call site — já aconteceu antes
-- neste projeto), cada MOVIMENTO grava seu próprio unit_cost/total_value
-- no momento em que acontece, via um trigger `before insert` que roda
-- pra TODO insert em inventory_movements, não importa de onde venha
-- (compra automática pela despesa, baixa manual, baixa automática de
-- consumo, ajuste de contagem). O "custo médio atual" e o "valor total
-- em estoque" nunca são colunas próprias — são sempre derivados por
-- soma a partir dos movimentos (mesma filosofia já usada por
-- inventory_balances pra quantidade), eliminando qualquer risco de
-- desvio (drift) entre um valor guardado e a soma real dos movimentos.

alter table inventory_movements
  add column unit_cost numeric(14,6),
  add column total_value numeric(12,2);

-- Pra uma COMPRA: usa o custo líquido já calculado na despesa (subtotal,
-- já com desconto/frete/tributo não recuperável aplicados — Módulo
-- Contábil Leva 2), não o unit_cost bruto da nota. Pra qualquer outro
-- tipo de movimento (baixa manual, baixa automática de consumo, ajuste de
-- contagem): usa o custo médio vigente ANTES deste movimento — numa
-- trigger `before insert`, consultar a própria tabela reflete exatamente
-- o estado "antes", já que esta linha ainda não foi gravada.
-- `security definer` (mesmo padrão de toda trigger deste schema): quem
-- dispara o insert pode ser uma camareira (baixa manual) sem acesso de
-- leitura a `expense_items`, mas o cálculo do custo médio só lê
-- `inventory_movements` (liberado a qualquer autenticado) — e, no caso
-- 'compra', o próprio insert sempre vem de uma trigger já security
-- definer (create_movement_from_expense_item), então não há ganho real
-- de permissão aqui, só consistência com o padrão do arquivo.
create or replace function compute_inventory_movement_value() returns trigger as $$
declare
  v_subtotal numeric;
  v_exp_qty numeric;
  v_avg_cost numeric;
begin
  if new.movement_type = 'compra' then
    select subtotal, quantity into v_subtotal, v_exp_qty
    from expense_items where id = new.reference_expense_item_id;

    new.total_value := coalesce(v_subtotal, 0);
    new.unit_cost := case when coalesce(v_exp_qty, 0) > 0 then round(v_subtotal / v_exp_qty, 6) else 0 end;
  else
    select coalesce(sum(total_value), 0) / nullif(sum(quantity), 0)
    into v_avg_cost
    from inventory_movements
    where inventory_item_id = new.inventory_item_id;

    new.unit_cost := coalesce(v_avg_cost, 0);
    new.total_value := round(new.quantity * coalesce(v_avg_cost, 0), 2);
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger inventory_movements_compute_value
before insert on inventory_movements
for each row execute function compute_inventory_movement_value();

-- Backfill dos movimentos já existentes (dado real, nunca zerado) — a
-- mesma lógica acima, aplicada em ORDEM CRONOLÓGICA por item, já que o
-- custo médio de um movimento depende dos movimentos anteriores dele
-- (nunca pode ser feito com um UPDATE em lote só, sem ordem).
do $$
declare
  v_item record;
  v_mv record;
  v_balance numeric;
  v_value numeric;
  v_subtotal numeric;
  v_exp_qty numeric;
  v_unit_cost numeric;
  v_total_value numeric;
begin
  for v_item in select id from inventory_items loop
    v_balance := 0;
    v_value := 0;
    for v_mv in
      select id, movement_type, quantity, reference_expense_item_id
      from inventory_movements
      where inventory_item_id = v_item.id
      order by created_at, id
    loop
      if v_mv.movement_type = 'compra' then
        select subtotal, quantity into v_subtotal, v_exp_qty
        from expense_items where id = v_mv.reference_expense_item_id;
        v_total_value := coalesce(v_subtotal, 0);
        v_unit_cost := case when coalesce(v_exp_qty, 0) > 0 then round(v_subtotal / v_exp_qty, 6) else 0 end;
      else
        v_unit_cost := case when v_balance > 0 then round(v_value / v_balance, 6) else 0 end;
        v_total_value := round(v_mv.quantity * v_unit_cost, 2);
      end if;

      update inventory_movements set unit_cost = v_unit_cost, total_value = v_total_value where id = v_mv.id;

      v_balance := v_balance + v_mv.quantity;
      v_value := v_value + v_total_value;
    end loop;
  end loop;
end $$;

alter table inventory_movements alter column unit_cost set not null;
alter table inventory_movements alter column total_value set not null;

-- inventory_balances ganha o valor monetário total e o custo médio atual
-- (derivados, nunca materializados à parte) — extensão, não substitui as
-- colunas já existentes; todo código que já lê "balance" continua
-- funcionando sem mudança.
create or replace view inventory_balances
with (security_invoker = true) as
select
  inventory_item_id,
  coalesce(sum(quantity), 0) as balance,
  coalesce(sum(total_value), 0) as value,
  case when coalesce(sum(quantity), 0) > 0 then sum(total_value) / sum(quantity) else 0 end as avg_cost
from inventory_movements
group by inventory_item_id;

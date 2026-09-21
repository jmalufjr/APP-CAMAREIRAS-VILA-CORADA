-- Numeração da comanda passa a ser sequencial por mês (1, 2, 3... pela
-- ordem de lançamento), em vez de por conta corrente do quarto (que
-- reiniciava toda vez que uma conta nova nascia, gerando "Comanda #1" em
-- várias suítes ao mesmo tempo). sequence_number continua existindo
-- (ainda usado internamente por edit_comanda para não colidir dentro de
-- uma mesma conta) — monthly_number é só o número exibido nas telas.
--
-- Atribuído uma única vez, no momento da criação da comanda
-- (submit_comanda) — nunca recalculado depois, mesmo que a comanda seja
-- editada (troque de quarto/conta) ou cancelada: o número reflete a
-- ordem de LANÇAMENTO original, não o estado atual.
alter table bar_comandas add column monthly_number int;

-- Backfill das comandas já lançadas neste mês (o pedido foi renumerar "se
-- possível, desde a primeira comanda lançada este mês" — meses anteriores
-- não são renumerados, não têm nenhuma tela que os exiba além da janela
-- de 7 dias de "Comandas inativas", que nunca alcança um mês fechado).
with month_start as (
  select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as ts
),
numbered as (
  select b.id, row_number() over (order by b.created_at asc) as rn
  from bar_comandas b, month_start
  where b.created_at >= month_start.ts
)
update bar_comandas b
set monthly_number = n.rn
from numbered n
where b.id = n.id;

-- submit_comanda passa a calcular também o monthly_number, com a mesma
-- lógica do backfill acima (reinicia em 1 a cada novo mês, em horário de
-- Brasília, independente do fuso do servidor).
create or replace function submit_comanda(p_room_id uuid, p_items jsonb)
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

  return v_comanda_id;
end;
$$ language plpgsql security definer;

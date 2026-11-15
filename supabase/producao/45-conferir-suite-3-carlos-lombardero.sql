-- SOMENTE LEITURA: confere todas as comandas da Suite 3 / Carlos Renato Lombardero.
-- 1) contas dessa suite e desse hospede
select r.number as suite, b.id as conta, b.status, b.guest_name_hint as hospede, b.stay_check_in, b.stay_check_out,
       b.opened_at, b.closed_at, b.paid_at, b.service_charge_waived as taxa_isenta
from room_bills b left join rooms r on r.id = b.room_id
where (r.number = '3' or b.guest_name_hint ilike '%lombardero%')
order by b.opened_at desc;

-- 2) todas as comandas dessas contas (com quem lancou, quem mexeu por ultimo e quando)
select c.monthly_number as comanda, c.status, c.created_at at time zone 'America/Sao_Paulo' as lancada_em,
       pc.name as lancada_por, c.last_action_at at time zone 'America/Sao_Paulo' as ultima_acao_em, pl.name as ultima_acao_por,
       b.guest_name_hint as conta_hospede, b.status as status_conta,
       (select string_agg(pi.name || ' x' || i.quantity, ', ' order by pi.name)
          from bar_comanda_items i join poolbar_items pi on pi.id = i.poolbar_item_id where i.comanda_id = c.id) as itens,
       (c.signature_png is not null) as assinada
from bar_comandas c
join room_bills b on b.id = c.bill_id
left join rooms r on r.id = b.room_id
left join profiles pc on pc.id = c.created_by
left join profiles pl on pl.id = c.last_action_by
where r.number = '3' or b.guest_name_hint ilike '%lombardero%'
order by c.created_at desc;

-- 3) total de caipirinhas por conta (sem as canceladas)
select b.id as conta, b.guest_name_hint, pi.name as item, sum(i.quantity) as quantidade
from bar_comanda_items i
join bar_comandas c on c.id = i.comanda_id and c.status <> 'cancelada'
join room_bills b on b.id = c.bill_id
left join rooms r on r.id = b.room_id
join poolbar_items pi on pi.id = i.poolbar_item_id
where (r.number = '3' or b.guest_name_hint ilike '%lombardero%') and pi.name ilike '%caipi%'
group by b.id, b.guest_name_hint, pi.name
order by b.id, pi.name;

-- 4) comandas canceladas ou editadas (quem e quando) - para ver se algo foi alterado depois
select c.monthly_number as comanda, c.status, pl.name as ultima_acao_por, c.last_action_at at time zone 'America/Sao_Paulo' as quando
from bar_comandas c
join room_bills b on b.id = c.bill_id
left join rooms r on r.id = b.room_id
left join profiles pl on pl.id = c.last_action_by
where (r.number = '3' or b.guest_name_hint ilike '%lombardero%') and c.status in ('cancelada','editada')
order by c.last_action_at desc;

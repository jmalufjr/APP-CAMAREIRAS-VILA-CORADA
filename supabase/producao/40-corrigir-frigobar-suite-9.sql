-- Corrige o frigobar da conta ABERTA da Suíte 9 (Vivien Reis):
-- soma +2 Água sem gás e +1 Refrigerante ao que já está lançado (consumo do dia 13 que foi sobrescrito).
-- Só roda se houver exatamente 1 conta aberta/reaberta da Suíte 9 com "Vivien" no nome e 1 item de cada.
do $$
declare
  v_bill uuid; v_agua uuid; v_refri uuid; v_n int;
begin
  select count(*) into v_n from room_bills b join rooms r on r.id = b.room_id
   where r.number = '9' and b.status in ('aberta','reaberta') and b.guest_name_hint ilike '%Vivien%';
  if v_n <> 1 then raise exception 'Esperava 1 conta da Suite 9 (Vivien), achei %', v_n; end if;
  select b.id into v_bill from room_bills b join rooms r on r.id = b.room_id
   where r.number = '9' and b.status in ('aberta','reaberta') and b.guest_name_hint ilike '%Vivien%';

  select count(*) into v_n from minibar_items where name ilike '%água%sem%gás%' or name ilike '%agua%sem%gas%';
  if v_n <> 1 then raise exception 'Esperava 1 item Agua sem gas, achei %', v_n; end if;
  select id into v_agua from minibar_items where name ilike '%água%sem%gás%' or name ilike '%agua%sem%gas%';

  select count(*) into v_n from minibar_items where name ilike '%refrigerante%';
  if v_n <> 1 then raise exception 'Esperava 1 item Refrigerante, achei %', v_n; end if;
  select id into v_refri from minibar_items where name ilike '%refrigerante%';

  insert into room_bill_minibar_items (bill_id, minibar_item_id, quantity, price_snapshot, updated_at)
  select v_bill, v_agua, 2, price, now() from minibar_items where id = v_agua
  on conflict (bill_id, minibar_item_id) do update set quantity = room_bill_minibar_items.quantity + 2, updated_at = now();

  insert into room_bill_minibar_items (bill_id, minibar_item_id, quantity, price_snapshot, updated_at)
  select v_bill, v_refri, 1, price, now() from minibar_items where id = v_refri
  on conflict (bill_id, minibar_item_id) do update set quantity = room_bill_minibar_items.quantity + 1, updated_at = now();
end $$;

-- Conferência (deve mostrar Água sem gás = 3 e Refrigerante = 1):
select mi.name, rbm.quantity
from room_bill_minibar_items rbm
join minibar_items mi on mi.id = rbm.minibar_item_id
join room_bills b on b.id = rbm.bill_id
join rooms r on r.id = b.room_id
where r.number = '9' and b.status in ('aberta','reaberta') and b.guest_name_hint ilike '%Vivien%' and rbm.quantity > 0;

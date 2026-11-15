-- Conta paga nunca e reaberta nem recriada pelo sistema: se a reserva ja tem conta paga e nenhuma
-- aberta, nao cria outra (consumo achado depois e perda). Pre-requisito: 115.
create or replace function ensure_room_bill_for_reservation(
  p_room_id uuid, p_reservation_id text, p_guest_name text, p_check_in date, p_check_out date
) returns room_bills as $$
declare
  v_bill room_bills;
begin
  if not (is_camareira() or is_admin_or_gerente()) then
    raise exception 'not authorized';
  end if;
  if p_reservation_id is null or p_reservation_id = '' then
    raise exception 'Reserva nao informada.';
  end if;

  select * into v_bill from room_bills
  where room_id = p_room_id and stays_reservation_id = p_reservation_id and status <> 'paga'
  limit 1;
  if v_bill.id is not null then
    return v_bill;
  end if;

  if exists (select 1 from room_bills where room_id = p_room_id and stays_reservation_id = p_reservation_id and status = 'paga') then
    raise exception 'A conta deste hóspede já foi paga; não é possível lançar novo consumo nela.';
  end if;

  begin
    insert into room_bills (room_id, status, guest_slot, stays_reservation_id, guest_name_hint, stay_check_in, stay_check_out)
    values (p_room_id, 'aberta', 'unica', p_reservation_id, p_guest_name, p_check_in, p_check_out)
    returning * into v_bill;
  exception when unique_violation then
    select * into v_bill from room_bills
    where room_id = p_room_id and stays_reservation_id = p_reservation_id and status <> 'paga'
    limit 1;
  end;
  return v_bill;
end;
$$ language plpgsql security definer set search_path = public;

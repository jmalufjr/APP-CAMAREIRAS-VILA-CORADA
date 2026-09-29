-- Corrige um bug real da Parte 44: as funções de gatilho que sustentam o
-- histórico de mudanças (version/room_bill_change_events, usado pela API
-- de consumos) não eram `security definer`. Isso passava despercebido
-- porque uma mudança feita pelo ADMIN (que tem policy de UPDATE em
-- room_bills) disparava o gatilho normalmente — mas uma mudança feita pela
-- CAMAREIRA (que não tem policy de UPDATE direta em room_bills, só via
-- funções security definer específicas) fazia o UPDATE interno de
-- bump_parent_bill_direct/bump_parent_bill_via_comanda combinar zero
-- linhas sob RLS — sem erro nenhum, mas também sem nenhum gatilho
-- disparado: version nunca era incrementada e nenhum evento era
-- registrado. Como a esmagadora maioria dos lançamentos de frigobar/
-- comanda do dia a dia é feita por camareiras, isso deixava o histórico
-- de mudanças incompleto na prática, exatamente o problema que a Parte 44
-- pretendia eliminar ao mover essa responsabilidade pro banco.
create or replace function log_room_bill_change_event() returns trigger as $$
begin
  insert into room_bill_change_events (bill_id, version) values (new.id, new.version);
  return new;
end;
$$ language plpgsql security definer;

create or replace function bump_parent_bill_direct() returns trigger as $$
declare
  v_bill_id uuid;
begin
  v_bill_id := coalesce(new.bill_id, old.bill_id);
  update room_bills set version = version where id = v_bill_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace function bump_parent_bill_via_comanda() returns trigger as $$
declare
  v_comanda_id uuid;
  v_bill_id uuid;
begin
  v_comanda_id := coalesce(new.comanda_id, old.comanda_id);
  select bill_id into v_bill_id from bar_comandas where id = v_comanda_id;
  if v_bill_id is not null then
    update room_bills set version = version where id = v_bill_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- A taxa de serviço de 10% sobre o bar da piscina não é uma cobrança
-- obrigatória por lei (CDC) — o hóspede pode recusar o pagamento dela ao
-- fechar a conta. Quando isso acontece, a camareira isenta a taxa nessa
-- conta específica: o total da conta passa a não incluir mais os 10%, e
-- nenhuma comanda que compõe essa conta gera comissão de 10% pra quem a
-- lançou (ver getBarCommissionByCamareira*, em comandas.ts, que passa a
-- ignorar comandas de uma conta isenta). Nunca afeta outra conta (mesmo
-- de outro ciclo da mesma suíte) nem outra comanda da mesma camareira que
-- não pertença a essa conta.
alter table room_bills add column service_charge_waived boolean not null default false;

-- Segue o mesmo padrão de close_room_bill/reopen_room_bill/pay_room_bill:
-- ação da camareira, via função security definer, nunca update direto.
-- Permitida em qualquer status não pago (aberta/fechada/reaberta) — o
-- hóspede pode recusar a taxa antes ou no momento de fechar a conta; uma
-- vez paga, a conta é histórico imutável, igual a qualquer outro valor já
-- congelado no projeto.
create or replace function set_room_bill_service_charge_waived(p_room_id uuid, p_waived boolean)
returns void as $$
declare
  v_bill_id uuid;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id into v_bill_id from room_bills where room_id = p_room_id and status <> 'paga' for update;
  if v_bill_id is null then
    insert into room_bills (room_id, status) values (p_room_id, 'aberta') returning id into v_bill_id;
  end if;

  update room_bills set service_charge_waived = p_waived where id = v_bill_id;
end;
$$ language plpgsql security definer;

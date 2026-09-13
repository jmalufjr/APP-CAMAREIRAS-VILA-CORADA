-- Envio automático do recibo em PDF por e-mail quando a camareira informa o
-- pagamento da conta de um quarto (não no fechamento). O envio é "melhor
-- esforço": nunca bloqueia a confirmação de pagamento pra camareira — só
-- fica registrado se deu certo ou não, pra o admin ver e poder reenviar.
alter table room_bills add column receipt_email_sent boolean not null default false;

-- pay_room_bill precisa devolver o id da conta recém-paga (antes retornava
-- void) para o código conseguir gerar/enviar o recibo daquela conta
-- específica logo em seguida. Muda o tipo de retorno, então precisa DROP
-- antes (Postgres não permite CREATE OR REPLACE mudar o tipo de retorno).
drop function pay_room_bill(uuid);

create function pay_room_bill(p_room_id uuid)
returns uuid as $$
declare
  v_bill_id uuid;
  v_status room_bill_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_status from room_bills where room_id = p_room_id and status <> 'paga' for update;
  if v_status is distinct from 'fechada' then
    raise exception 'Feche a conta antes de registrar o pagamento.';
  end if;

  update room_bills set status = 'paga', paid_at = now(), paid_by = auth.uid() where id = v_bill_id;
  insert into room_bills (room_id, status) values (p_room_id, 'aberta');

  return v_bill_id;
end;
$$ language plpgsql security definer;

-- Grava se o e-mail do recibo foi enviado com sucesso para aquela conta.
-- Chamada tanto pela camareira (logo após pagar, com o resultado do envio
-- automático) quanto pelo admin (ao reenviar manualmente).
create or replace function mark_receipt_email_sent(p_bill_id uuid, p_sent boolean)
returns void as $$
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'not authorized';
  end if;

  update room_bills set receipt_email_sent = p_sent where id = p_bill_id;
end;
$$ language plpgsql security definer;

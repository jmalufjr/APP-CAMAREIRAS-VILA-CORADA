-- Método de pagamento informado pela camareira ao confirmar "Pagamento
-- efetuado" — decisão do proprietário: não existe pagamento parcial nem
-- estorno neste app (o valor cobrado é sempre o total já calculado ao
-- fechar a conta), então basta registrar qual dos 5 métodos foi usado.
create type payment_method as enum (
  'pix',
  'cartao_credito',
  'cartao_debito',
  'transferencia_bancaria',
  'dinheiro'
);

alter table room_bills add column payment_method payment_method;

-- pay_room_bill passa a receber o método escolhido pela camareira e
-- gravá-lo junto com o pagamento. Assinatura mudou (novo parâmetro
-- obrigatório) — remove a versão antiga para não deixar as duas
-- coexistindo como funções sobrecarregadas.
drop function if exists pay_room_bill(uuid);

create or replace function pay_room_bill(p_room_id uuid, p_payment_method payment_method)
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

  update room_bills
  set status = 'paga', paid_at = now(), paid_by = auth.uid(), payment_method = p_payment_method
  where id = v_bill_id;
  insert into room_bills (room_id, status) values (p_room_id, 'aberta');

  return v_bill_id;
end;
$$ language plpgsql security definer;

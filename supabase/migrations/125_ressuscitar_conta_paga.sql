-- Reabrir ("ressuscitar") uma conta paga por engano: só o administrador, só contas pagas a partir de 18/11/2026.
-- A conta volta como ABERTA, com todo o consumo lançado, sem o registro de fechamento/pagamento; o que
-- aconteceu fica guardado em reactivation_log (quem informou o pagamento, quando, quem reabriu e quando).

alter table room_bills add column if not exists reactivation_log jsonb not null default '[]'::jsonb;

create or replace function resurrect_room_bill(p_bill_id uuid)
returns void as $$
declare
  b room_bills%rowtype;
  v_paid_name text;
  v_actor text;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select * into b from room_bills where id = p_bill_id for update;
  if not found then
    raise exception 'Conta não encontrada.';
  end if;
  if b.status <> 'paga' then
    raise exception 'Só uma conta paga pode ser reaberta desta forma.';
  end if;
  if b.paid_at < timestamptz '2026-11-18 00:00:00-03' then
    raise exception 'Só contas pagas a partir de 18/11/2026 podem ser reabertas desta forma.';
  end if;

  select name into v_paid_name from profiles where id = b.paid_by;
  select name into v_actor from profiles where id = auth.uid();

  begin
    update room_bills
    set status = 'aberta',
        closed_at = null, closed_by = null,
        reopened_at = null, reopened_by = null,
        paid_at = null, paid_by = null, payment_method = null,
        reactivation_log = reactivation_log || jsonb_build_array(jsonb_build_object(
          'paid_at', b.paid_at,
          'paid_by_name', v_paid_name,
          'payment_method', b.payment_method,
          'reopened_at', now(),
          'reopened_by_name', v_actor
        ))
    where id = p_bill_id;
  exception when unique_violation then
    raise exception 'Já existe outra conta não paga para este hóspede nesta suíte; não é possível reabrir esta.';
  end;
end;
$$ language plpgsql security definer;

-- Comanda: assinatura do hospede ao fazer o pedido (imagem + data/hora da assinatura).
alter table bar_comandas
  add column if not exists signature_png text,
  add column if not exists signed_at timestamptz;

-- Lanca a comanda (mesma regra de submit_comanda) e grava a assinatura na MESMA transacao:
-- ou ficam as duas coisas, ou nenhuma. A hora da assinatura e a do servidor (now()).
create or replace function submit_comanda_signed(
  p_room_id uuid,
  p_items jsonb,
  p_guest_slot room_bill_guest_slot,
  p_signature text
) returns uuid as $$
declare
  v_id uuid;
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'Sem permissão.';
  end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' then
    raise exception 'Assinatura inválida.';
  end if;
  if length(p_signature) > 400000 then
    raise exception 'Assinatura grande demais.';
  end if;

  v_id := submit_comanda(p_room_id, p_items, p_guest_slot);

  update bar_comandas set signature_png = p_signature, signed_at = now() where id = v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

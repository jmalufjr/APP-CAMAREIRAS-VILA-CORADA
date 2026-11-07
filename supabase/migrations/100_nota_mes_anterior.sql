-- Mes anterior: a nota de cada camareira e editada direto na tabela (sem botao "Calcular").
-- A nota fica em commission_statements.score (uma linha por periodo e camareira); sem linha, vale 10.
create or replace function set_commission_period_score(
  p_period_end date, p_camareira_id uuid, p_camareira_name text, p_score int
) returns void as $$
begin
  if not is_admin_or_gerente() then
    raise exception 'not authorized';
  end if;
  if p_score < 0 or p_score > 10 then
    raise exception 'Nota inválida.';
  end if;
  insert into commission_statements (period_end, camareira_id, camareira_name, score)
  values (p_period_end, p_camareira_id, p_camareira_name, p_score)
  on conflict (period_end, camareira_id) do update set score = excluded.score, generated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

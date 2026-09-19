-- Camareira cancela a própria escolha de uma suíte já reivindicada (antes
-- de finalizar): devolve o serviço pra lista de disponíveis, apagando tudo
-- que foi preenchido nessa reivindicação (itens marcados no checklist,
-- ocorrências registradas, observação) — como se a suíte nunca tivesse
-- sido escolhida. Diferente de cancel_daily_room_task (migration 028), que
-- só cancela um serviço PENDENTE de dia anterior ainda não reivindicado
-- por ninguém.
--
-- Precisa ser security definer (não uma policy de UPDATE): a policy
-- drt_camareira_update_own exige with check (assigned_to = auth.uid()), o
-- que rejeitaria justamente a transição que queremos (assigned_to virando
-- null) — mesmo padrão já documentado no CLAUDE.md pra qualquer transição
-- de estado sensível envolvendo mais de uma coluna/tabela.
create or replace function cancel_own_claimed_task(p_task_id uuid) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from daily_room_tasks
    where id = p_task_id and assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  ) then
    raise exception 'not authorized';
  end if;

  delete from daily_room_task_occurrences where daily_room_task_id = p_task_id;

  update daily_room_task_checks
  set checked = false, checked_at = null
  where daily_room_task_id = p_task_id;

  update daily_room_tasks
  set assigned_to = null, claimed_at = null, started_at = null, status = 'pendente', notes = null
  where id = p_task_id;
end;
$$ language plpgsql security definer;

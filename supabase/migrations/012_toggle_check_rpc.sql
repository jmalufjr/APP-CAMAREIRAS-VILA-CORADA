-- Colapsa o toggle de um item de checklist (que hoje faz 1 select + até 3
-- updates sequenciais em daily_room_task_checks/daily_room_tasks) em uma
-- única função security definer, reduzindo o toggle a 1 round trip ao banco.
-- Checa explicitamente que a tarefa pertence à camareira autenticada, no
-- mesmo padrão usado por select_occurrence/resolve_occurrence.
create or replace function toggle_daily_room_task_check(p_check_id uuid, p_checked boolean)
returns void as $$
declare
  v_task_id uuid;
begin
  select daily_room_task_id into v_task_id
  from daily_room_task_checks
  where id = p_check_id;

  if v_task_id is null then
    raise exception 'check not found';
  end if;

  if not exists (
    select 1 from daily_room_tasks
    where id = v_task_id and assigned_to = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  update daily_room_task_checks
  set checked = p_checked, checked_at = case when p_checked then now() else null end
  where id = p_check_id;

  update daily_room_tasks
  set status = 'em_andamento'
  where id = v_task_id and status = 'pendente';

  update daily_room_tasks
  set started_at = now()
  where id = v_task_id and started_at is null;
end;
$$ language plpgsql security definer;

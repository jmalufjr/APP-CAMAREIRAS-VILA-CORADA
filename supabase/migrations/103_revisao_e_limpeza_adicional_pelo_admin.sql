-- Revisao opcional (padrao: dispensada) e limpeza adicional editavel pelo admin/gerente no Planejamento diario.
alter table daily_room_tasks
  add column if not exists review_required boolean not null default false,
  add column if not exists extra_cleaning_locked boolean not null default false;

-- Liberar a suite: vai para revisao so se o admin/gerente habilitou; senao conclui direto.
create or replace function release_daily_room_task(p_task_id uuid, p_notes text) returns void as $$
declare
  v_review boolean;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from daily_room_tasks
    where id = p_task_id and assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  ) then
    raise exception 'Este serviço não está disponível para liberar.';
  end if;
  if exists (select 1 from daily_room_tasks where id = p_task_id and extra_cleaning and second_assigned_to is null) then
    raise exception 'A limpeza adicional precisa da segunda camareira antes de ser liberada.';
  end if;
  if exists (select 1 from daily_room_task_checks where daily_room_task_id = p_task_id and not checked) then
    raise exception 'Marque todos os itens do checklist antes de liberar a suíte.';
  end if;
  select review_required into v_review from daily_room_tasks where id = p_task_id;
  if v_review then
    update daily_room_tasks
    set status = 'aguardando_revisao', finished_at = now(), released_at = now(), notes = nullif(p_notes, '')
    where id = p_task_id;
  else
    update daily_room_tasks
    set status = 'concluido', finished_at = now(), released_at = now(), completed_at = now(), notes = nullif(p_notes, '')
    where id = p_task_id;
  end if;
end;
$$ language plpgsql security definer;

-- Admin/gerente habilita ou dispensa a revisao de um servico (antes de a suite ser liberada).
create or replace function set_task_review_required(p_task_id uuid, p_value boolean) returns void as $$
begin
  if not is_admin_or_gerente() then
    raise exception 'not authorized';
  end if;
  update daily_room_tasks set review_required = p_value
  where id = p_task_id and status in ('pendente', 'em_andamento');
  if not found then
    raise exception 'A revisão só pode ser alterada antes de a suíte ser liberada.';
  end if;
end;
$$ language plpgsql security definer;

-- Admin/gerente inclui ou exclui a limpeza adicional de um servico ainda nao escolhido por camareira.
-- A edicao fica travada (extra_cleaning_locked) e a sincronizacao parcial a respeita.
create or replace function set_task_extra_cleaning(p_task_id uuid, p_value boolean) returns void as $$
declare
  v_room uuid;
begin
  if not is_admin_or_gerente() then
    raise exception 'not authorized';
  end if;
  select room_id into v_room from daily_room_tasks
  where id = p_task_id and status = 'pendente' and assigned_to is null
    and task_type in ('troca', 'preparacao', 'somente_saida');
  if v_room is null then
    raise exception 'A limpeza adicional só pode ser alterada em troca, saída com chegada ou somente saída ainda não escolhida por uma camareira.';
  end if;

  update daily_room_tasks
  set extra_cleaning = p_value, extra_cleaning_locked = true, second_assigned_to = null, second_claimed_at = null
  where id = p_task_id;

  if p_value then
    insert into daily_room_task_checks (daily_room_task_id, checklist_item_id)
    select p_task_id, rci.checklist_item_id
    from room_checklist_items rci
    join checklist_items ci on ci.id = rci.checklist_item_id
    where rci.room_id = v_room and ci.type = 'limpeza_adicional' and ci.active
      and not exists (
        select 1 from daily_room_task_checks c
        where c.daily_room_task_id = p_task_id and c.checklist_item_id = rci.checklist_item_id
      );
  else
    delete from daily_room_task_checks
    where daily_room_task_id = p_task_id
      and checklist_item_id in (select id from checklist_items where type = 'limpeza_adicional');
  end if;
end;
$$ language plpgsql security definer;

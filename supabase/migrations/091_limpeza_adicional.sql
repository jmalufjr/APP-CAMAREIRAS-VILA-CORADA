-- Limpeza adicional: marca na tarefa, segunda camareira, itens extras e funcoes.
-- Pre-requisito: 090 ja rodada.

alter table daily_room_tasks
  add column if not exists extra_cleaning boolean not null default false,
  add column if not exists second_assigned_to uuid references profiles(id) on delete set null,
  add column if not exists second_claimed_at timestamptz;

-- A camareira enxerga a tarefa de limpeza adicional que aguarda a segunda camareira, e a que ela
-- mesma escolheu como segunda.
drop policy if exists drt_camareira_select_second on daily_room_tasks;
create policy drt_camareira_select_second on daily_room_tasks for select
  using (is_camareira() and (
    second_assigned_to = auth.uid()
    or (extra_cleaning and assigned_to is not null and second_assigned_to is null and status in ('pendente', 'em_andamento'))
  ));

-- 4 itens extras (so se ainda nao existir nenhum) e associacao a todas as suites.
insert into checklist_items (type, label, description, position)
select 'limpeza_adicional', v.label, v.descr, v.pos
from (values
  ('Limpeza do filtro do ar condicionado', 'Usar escada, retirar o filtro, lavar o filtro na lavanderia e enxugar, colocar de volta o filtro e passar pano com produto de limpeza no ar condicionado.', 1),
  ('Limpeza do topo do armário de roupas', 'Passar pano úmido com produto de limpeza no topo do armário.', 2),
  ('Limpeza da base da cama', 'Retirar o colchão e aspirar em cima e embaixo da base da cama, passar pano com produto de limpeza na lateral da base e limpar os pés da base.', 3),
  ('Limpeza do espelho da cama', 'Aspirar, passar pano com produto de limpeza e passar lustra-móveis.', 4)
) as v(label, descr, pos)
where not exists (select 1 from checklist_items where type = 'limpeza_adicional');

insert into room_checklist_items (room_id, checklist_item_id, position)
select r.id, ci.id, ci.position
from rooms r cross join checklist_items ci
where ci.type = 'limpeza_adicional'
on conflict do nothing;

-- Segunda camareira escolhe a limpeza adicional: so entao o servico pode comecar.
create or replace function claim_extra_cleaning_second(p_task_id uuid) returns void as $$
declare
  v_extra boolean;
  v_first uuid;
  v_second uuid;
  v_status task_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  select extra_cleaning, assigned_to, second_assigned_to, status
    into v_extra, v_first, v_second, v_status
  from daily_room_tasks where id = p_task_id for update;
  if v_extra is null or not v_extra then
    raise exception 'Este serviço não é uma limpeza adicional.';
  end if;
  if v_first is null then
    raise exception 'A primeira camareira ainda não escolheu este serviço.';
  end if;
  if v_second is not null then
    raise exception 'Este serviço já tem as duas camareiras.';
  end if;
  if v_first = auth.uid() then
    raise exception 'A segunda camareira precisa ser diferente da primeira.';
  end if;
  if v_status not in ('pendente', 'em_andamento') then
    raise exception 'Este serviço não está disponível.';
  end if;
  update daily_room_tasks
  set second_assigned_to = auth.uid(), second_claimed_at = now(), claimed_at = now()
  where id = p_task_id;
end;
$$ language plpgsql security definer;

-- Cancelar a propria escolha: a primeira devolve o servico ao pool (limpando a segunda);
-- a segunda so libera a vaga dela.
create or replace function cancel_own_claimed_task(p_task_id uuid) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  if exists (
    select 1 from daily_room_tasks
    where id = p_task_id and second_assigned_to = auth.uid() and status in ('pendente', 'em_andamento')
  ) then
    update daily_room_tasks
    set second_assigned_to = null, second_claimed_at = null, claimed_at = null
    where id = p_task_id;
    return;
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
  set assigned_to = null, claimed_at = null, started_at = null, status = 'pendente', notes = null,
      second_assigned_to = null, second_claimed_at = null
  where id = p_task_id;
end;
$$ language plpgsql security definer;

-- Nao comeca nem libera sem a segunda camareira.
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

  if exists (
    select 1 from daily_room_tasks
    where id = v_task_id and extra_cleaning and second_assigned_to is null and status in ('pendente', 'em_andamento')
  ) then
    raise exception 'A limpeza adicional só começa depois que a segunda camareira escolher o serviço.';
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

create or replace function release_daily_room_task(p_task_id uuid, p_notes text) returns void as $$
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
  update daily_room_tasks
  set status = 'aguardando_revisao', finished_at = now(), released_at = now(), notes = nullif(p_notes, '')
  where id = p_task_id;
end;
$$ language plpgsql security definer;

-- Revisora nunca e nenhuma das duas executoras.
create or replace function claim_review(p_task_id uuid) returns void as $$
declare
  v_status task_status;
  v_assigned uuid;
  v_second uuid;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  select status, assigned_to, second_assigned_to into v_status, v_assigned, v_second
  from daily_room_tasks where id = p_task_id for update;
  if v_status is null then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status <> 'aguardando_revisao' then
    raise exception 'Este serviço não está mais aguardando revisão.';
  end if;
  if v_assigned = auth.uid() or v_second = auth.uid() then
    raise exception 'A revisão precisa ser feita por uma camareira diferente das que executaram o serviço.';
  end if;
  update daily_room_tasks
  set status = 'em_revisao', reviewed_by = auth.uid(), review_claimed_at = now()
  where id = p_task_id;
end;
$$ language plpgsql security definer;

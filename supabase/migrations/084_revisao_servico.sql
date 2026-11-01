-- 084: camareira revisora (PRD_camareira_revisora.md)
-- Fluxo: executora libera -> aguardando_revisao -> (revisora escolhe) em_revisao ->
--   tudo completo => concluido; algum incompleto => aguardando_correcao ->
--   (executora inicia) em_correcao -> (finaliza) concluido.
-- Admin/gerente podem dispensar a revisão (aguardando_revisao -> concluido).

-- ---------- Colunas ----------
alter table daily_room_tasks
  add column if not exists reviewed_by uuid references profiles(id) on delete set null,
  add column if not exists review_claimed_at timestamptz,
  add column if not exists review_finished_at timestamptz,
  add column if not exists review_notes text,
  add column if not exists review_minibar_result text check (review_minibar_result in ('completo', 'incompleto')),
  add column if not exists review_waived_by uuid references profiles(id) on delete set null,
  add column if not exists review_waived_at timestamptz,
  add column if not exists correction_started_at timestamptz,
  add column if not exists correction_finished_at timestamptz,
  add column if not exists correction_minibar_done boolean not null default false,
  -- Quando o ciclo inteiro (execução + revisão + correção) terminou.
  add column if not exists completed_at timestamptz;

-- Serviços já concluídos antes desta migration continuam concluídos, sem revisão.
update daily_room_tasks set completed_at = coalesce(finished_at, created_at) where status = 'concluido' and completed_at is null;

alter table daily_room_task_checks
  add column if not exists review_result text check (review_result in ('completo', 'incompleto')),
  add column if not exists corrected boolean not null default false;

-- ---------- Segurança (RLS) ----------
-- A camareira só altera direto o serviço enquanto ele está sendo executado; depois
-- de liberado, todas as transições passam pelas funções abaixo.
alter policy drt_camareira_update_own on daily_room_tasks
  using (assigned_to = auth.uid() and status in ('pendente', 'em_andamento'))
  with check (assigned_to = auth.uid() and status in ('pendente', 'em_andamento'));

drop policy if exists drt_camareira_select_reviewer on daily_room_tasks;
create policy drt_camareira_select_reviewer on daily_room_tasks for select using (reviewed_by = auth.uid());
-- Serviços aguardando revisão ficam visíveis a toda camareira (é de onde ela escolhe).
drop policy if exists drt_camareira_select_review_pool on daily_room_tasks;
create policy drt_camareira_select_review_pool on daily_room_tasks for select
  using (status = 'aguardando_revisao' and is_camareira());

drop policy if exists drtc_reviewer_select on daily_room_task_checks;
create policy drtc_reviewer_select on daily_room_task_checks for select
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_checks.daily_room_task_id and t.reviewed_by = auth.uid()));

drop policy if exists drto_reviewer_select on daily_room_task_occurrences;
create policy drto_reviewer_select on daily_room_task_occurrences for select
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_occurrences.daily_room_task_id and t.reviewed_by = auth.uid()));
drop policy if exists drto_reviewer_insert on daily_room_task_occurrences;
create policy drto_reviewer_insert on daily_room_task_occurrences for insert
  with check (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_occurrences.daily_room_task_id and t.reviewed_by = auth.uid() and t.status = 'em_revisao'));
drop policy if exists drto_reviewer_delete on daily_room_task_occurrences;
create policy drto_reviewer_delete on daily_room_task_occurrences for delete
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_occurrences.daily_room_task_id and t.reviewed_by = auth.uid() and t.status = 'em_revisao'));

drop policy if exists drtop_reviewer_select on daily_room_task_occurrence_photos;
create policy drtop_reviewer_select on daily_room_task_occurrence_photos for select
  using (exists (
    select 1 from daily_room_task_occurrences o join daily_room_tasks t on t.id = o.daily_room_task_id
    where o.id = daily_room_task_occurrence_photos.occurrence_id and t.reviewed_by = auth.uid()));
drop policy if exists drtop_reviewer_insert on daily_room_task_occurrence_photos;
create policy drtop_reviewer_insert on daily_room_task_occurrence_photos for insert
  with check (exists (
    select 1 from daily_room_task_occurrences o join daily_room_tasks t on t.id = o.daily_room_task_id
    where o.id = daily_room_task_occurrence_photos.occurrence_id and t.reviewed_by = auth.uid() and t.status = 'em_revisao'));
drop policy if exists drtop_reviewer_delete on daily_room_task_occurrence_photos;
create policy drtop_reviewer_delete on daily_room_task_occurrence_photos for delete
  using (exists (
    select 1 from daily_room_task_occurrences o join daily_room_tasks t on t.id = o.daily_room_task_id
    where o.id = daily_room_task_occurrence_photos.occurrence_id and t.reviewed_by = auth.uid() and t.status = 'em_revisao'));

-- ---------- Funções (todas security definer, com checagem de papel/dono) ----------

-- Executora libera a suíte: vai pra revisão (não fica mais "concluído").
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
  if exists (select 1 from daily_room_task_checks where daily_room_task_id = p_task_id and not checked) then
    raise exception 'Marque todos os itens do checklist antes de liberar a suíte.';
  end if;
  update daily_room_tasks
  set status = 'aguardando_revisao', finished_at = now(), released_at = now(), notes = nullif(p_notes, '')
  where id = p_task_id;
end;
$$ language plpgsql security definer;

-- Revisora escolhe um serviço aguardando revisão (nunca o que ela mesma executou).
create or replace function claim_review(p_task_id uuid) returns void as $$
declare
  v_status task_status;
  v_assigned uuid;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  select status, assigned_to into v_status, v_assigned from daily_room_tasks where id = p_task_id for update;
  if v_status is null then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status <> 'aguardando_revisao' then
    raise exception 'Este serviço não está mais aguardando revisão.';
  end if;
  if v_assigned = auth.uid() then
    raise exception 'A revisão precisa ser feita por uma camareira diferente da que executou o serviço.';
  end if;
  update daily_room_tasks
  set status = 'em_revisao', reviewed_by = auth.uid(), review_claimed_at = now()
  where id = p_task_id;
end;
$$ language plpgsql security definer;

-- Revisora desiste antes de encerrar: o serviço volta a aguardar revisão, limpo.
create or replace function release_review(p_task_id uuid) returns void as $$
begin
  if not exists (select 1 from daily_room_tasks where id = p_task_id and reviewed_by = auth.uid() and status = 'em_revisao') then
    raise exception 'not authorized';
  end if;
  update daily_room_task_checks set review_result = null where daily_room_task_id = p_task_id;
  update daily_room_tasks
  set status = 'aguardando_revisao', reviewed_by = null, review_claimed_at = null,
      review_minibar_result = null, review_notes = null
  where id = p_task_id;
end;
$$ language plpgsql security definer;

create or replace function set_review_check_result(p_check_id uuid, p_result text) returns void as $$
declare
  v_task uuid;
begin
  if p_result is not null and p_result not in ('completo', 'incompleto') then
    raise exception 'Resultado inválido.';
  end if;
  select daily_room_task_id into v_task from daily_room_task_checks where id = p_check_id;
  if v_task is null or not exists (select 1 from daily_room_tasks where id = v_task and reviewed_by = auth.uid() and status = 'em_revisao') then
    raise exception 'not authorized';
  end if;
  update daily_room_task_checks set review_result = p_result where id = p_check_id;
end;
$$ language plpgsql security definer;

create or replace function set_review_minibar_result(p_task_id uuid, p_result text) returns void as $$
begin
  if p_result is not null and p_result not in ('completo', 'incompleto') then
    raise exception 'Resultado inválido.';
  end if;
  if not exists (select 1 from daily_room_tasks where id = p_task_id and reviewed_by = auth.uid() and status = 'em_revisao') then
    raise exception 'not authorized';
  end if;
  update daily_room_tasks set review_minibar_result = p_result where id = p_task_id;
end;
$$ language plpgsql security definer;

-- Encerra a revisão: todos os itens (e o frigobar) precisam ter resultado.
-- Algum incompleto -> correção; tudo completo -> serviço concluído.
create or replace function finish_review(p_task_id uuid, p_notes text) returns text as $$
declare
  v_minibar text;
  v_has_incomplete boolean;
begin
  select review_minibar_result into v_minibar
  from daily_room_tasks where id = p_task_id and reviewed_by = auth.uid() and status = 'em_revisao' for update;
  if not found then
    raise exception 'not authorized';
  end if;
  if v_minibar is null or exists (select 1 from daily_room_task_checks where daily_room_task_id = p_task_id and review_result is null) then
    raise exception 'Marque completo ou incompleto em todos os itens (inclusive o consumo de frigobar) antes de encerrar a revisão.';
  end if;
  v_has_incomplete := v_minibar = 'incompleto'
    or exists (select 1 from daily_room_task_checks where daily_room_task_id = p_task_id and review_result = 'incompleto');
  if v_has_incomplete then
    update daily_room_tasks set status = 'aguardando_correcao', review_finished_at = now(), review_notes = nullif(p_notes, '') where id = p_task_id;
    return 'aguardando_correcao';
  end if;
  update daily_room_tasks
  set status = 'concluido', review_finished_at = now(), completed_at = now(), review_notes = nullif(p_notes, '')
  where id = p_task_id;
  return 'concluido';
end;
$$ language plpgsql security definer;

create or replace function start_correction(p_task_id uuid) returns void as $$
begin
  if not exists (select 1 from daily_room_tasks where id = p_task_id and assigned_to = auth.uid() and status = 'aguardando_correcao') then
    raise exception 'not authorized';
  end if;
  update daily_room_tasks set status = 'em_correcao', correction_started_at = now() where id = p_task_id;
end;
$$ language plpgsql security definer;

create or replace function set_correction_check(p_check_id uuid, p_corrected boolean) returns void as $$
declare
  v_task uuid;
begin
  select daily_room_task_id into v_task from daily_room_task_checks where id = p_check_id and review_result = 'incompleto';
  if v_task is null or not exists (select 1 from daily_room_tasks where id = v_task and assigned_to = auth.uid() and status = 'em_correcao') then
    raise exception 'not authorized';
  end if;
  update daily_room_task_checks set corrected = p_corrected where id = p_check_id;
end;
$$ language plpgsql security definer;

create or replace function set_correction_minibar_done(p_task_id uuid, p_done boolean) returns void as $$
begin
  if not exists (select 1 from daily_room_tasks where id = p_task_id and assigned_to = auth.uid() and status = 'em_correcao' and review_minibar_result = 'incompleto') then
    raise exception 'not authorized';
  end if;
  update daily_room_tasks set correction_minibar_done = p_done where id = p_task_id;
end;
$$ language plpgsql security definer;

create or replace function finish_correction(p_task_id uuid) returns void as $$
declare
  v_minibar text;
  v_done boolean;
begin
  select review_minibar_result, correction_minibar_done into v_minibar, v_done
  from daily_room_tasks where id = p_task_id and assigned_to = auth.uid() and status = 'em_correcao' for update;
  if not found then
    raise exception 'not authorized';
  end if;
  if exists (select 1 from daily_room_task_checks where daily_room_task_id = p_task_id and review_result = 'incompleto' and not corrected)
     or (v_minibar = 'incompleto' and not v_done) then
    raise exception 'Marque todos os itens corrigidos antes de finalizar a correção.';
  end if;
  update daily_room_tasks set status = 'concluido', correction_finished_at = now(), completed_at = now() where id = p_task_id;
end;
$$ language plpgsql security definer;

-- Admin/gerente dispensam a revisão (ex.: não há outra camareira disponível).
create or replace function waive_review(p_task_id uuid) returns void as $$
begin
  if not is_admin_or_gerente() then
    raise exception 'not authorized';
  end if;
  update daily_room_tasks
  set status = 'concluido', review_waived_by = auth.uid(), review_waived_at = now(), completed_at = now()
  where id = p_task_id and status = 'aguardando_revisao';
  if not found then
    raise exception 'Este serviço não está aguardando revisão.';
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- Migração: escopo por semana na tela do funcionário de manutenção.
-- As funções de selecionar/concluir manutenção preventiva passam a receber
-- o intervalo de datas (due_from/due_to) do "card" da semana clicada, em vez
-- de sempre operar sobre hoje/amanhã. Como o número de parâmetros muda,
-- as funções antigas precisam ser removidas antes de recriar.
-- Pode ser rodada de uma vez só.
-- ============================================================================

drop function if exists claim_maintenance_category(uuid);
drop function if exists complete_maintenance_nao_tecnico(uuid);
drop function if exists complete_maintenance_tecnico(uuid, text);

create or replace function claim_maintenance_category(cat_id uuid, due_from date, due_to date) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update maintenance_items
  set status = 'selecionada', selected_by = auth.uid(), selected_at = now()
  where category_id = cat_id
    and active = true
    and status = 'pendente'
    and next_due_date between due_from and due_to;
end;
$$ language plpgsql security definer;

create or replace function complete_maintenance_nao_tecnico(cat_id uuid, due_from date, due_to date) returns void as $$
declare
  r record;
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  for r in
    select id, next_due_date, periodicity_days
    from maintenance_items
    where category_id = cat_id
      and execution_type = 'nao_tecnico'
      and status = 'selecionada'
      and selected_by = auth.uid()
      and next_due_date between due_from and due_to
  loop
    insert into maintenance_completions (item_id, due_date, completed_by)
    values (r.id, r.next_due_date, auth.uid());

    update maintenance_items
    set status = 'pendente', selected_by = null, selected_at = null,
        next_due_date = current_date + r.periodicity_days
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

create or replace function complete_maintenance_tecnico(cat_id uuid, due_from date, due_to date, external_name text) returns void as $$
declare
  r record;
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;
  if external_name is null or btrim(external_name) = '' then
    raise exception 'external technician name is required';
  end if;

  for r in
    select id, next_due_date, periodicity_days
    from maintenance_items
    where category_id = cat_id
      and execution_type = 'tecnico'
      and status = 'selecionada'
      and selected_by = auth.uid()
      and next_due_date between due_from and due_to
  loop
    insert into maintenance_completions (item_id, due_date, completed_by, external_technician_name)
    values (r.id, r.next_due_date, auth.uid(), btrim(external_name));

    update maintenance_items
    set status = 'pendente', selected_by = null, selected_at = null,
        next_due_date = current_date + r.periodicity_days
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

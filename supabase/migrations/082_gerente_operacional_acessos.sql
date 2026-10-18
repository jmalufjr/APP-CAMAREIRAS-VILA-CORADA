-- 082: o que o gerente operacional pode ler/gravar no banco. Ele NÃO vira
-- admin: só recebe as permissões das telas que usa (planejamento diário,
-- chegadas e saídas, mesas do café, consumo de bar/frigobar — só leitura —,
-- comissões, lançar compra, lista de compras, validade e baixa de estoque).

create or replace function is_gerente() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'gerente_operacional' and active = true
  );
$$ language sql security definer stable;

create or replace function is_admin_or_gerente() returns boolean as $$
  select is_admin() or is_gerente();
$$ language sql security definer stable;

-- 1) Políticas que já existem e passam a valer também pro gerente.
do $$
declare
  r record;
  v_using text;
  v_check text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (values
        -- planejamento diário
        ('daily_room_tasks', 'drt_admin_all'),
        ('daily_room_task_checks', 'drtc_admin_all'),
        ('daily_room_task_occurrences', 'drto_admin_all'),
        ('daily_room_task_exclusions', 'drte_admin_insert'),
        ('daily_room_task_exclusions', 'drte_admin_delete'),
        -- chegadas e saídas
        ('daily_arrivals', 'da_admin_write'),
        ('daily_arrivals', 'da_admin_update'),
        ('daily_arrivals', 'da_admin_delete'),
        ('daily_departures', 'dd_admin_write'),
        ('daily_departures', 'dd_admin_update'),
        ('daily_departures', 'dd_admin_delete'),
        -- mesas do café
        ('daily_breakfast', 'db_admin_write'),
        ('daily_breakfast', 'db_admin_update'),
        ('daily_breakfast', 'db_admin_delete'),
        ('daily_breakfast_settings', 'dbs_admin_write'),
        ('daily_breakfast_settings', 'dbs_admin_update'),
        ('daily_breakfast_settings', 'dbs_admin_delete'),
        ('daily_breakfast_room_assignments', 'dbra_admin_write'),
        ('daily_breakfast_room_assignments', 'dbra_admin_update'),
        ('daily_breakfast_room_assignments', 'dbra_admin_delete'),
        ('daily_breakfast_room_exclusions', 'dbre_admin_insert'),
        ('daily_breakfast_room_exclusions', 'dbre_admin_delete'),
        ('breakfast_tables', 'bt_admin_update'),
        -- comissões
        ('commission_settings', 'cs_admin_update'),
        ('commission_statements', 'cst_admin_all'),
        ('profiles', 'profiles_select_own_or_admin'),
        -- lançar compra / lista de compras / baixa de estoque / validade
        ('expenses', 'expenses_select_admin_manutencao'),
        ('expenses', 'expenses_insert_admin_manutencao'),
        ('expense_items', 'exp_items_select_admin_manutencao'),
        ('expense_items', 'exp_items_insert_admin_manutencao'),
        ('suppliers', 'suppliers_insert_admin_manutencao'),
        ('fixed_assets', 'fixed_assets_admin_all'),
        ('inventory_movements', 'inv_mov_insert_baixa_manual'),
        ('inventory_suggestion_dismissals', 'inv_suggestion_dismissals_admin_all'),
        ('purchase_requests', 'purchase_req_select_own_or_admin')
      )
  loop
    v_using := case when r.qual is not null then 'using (' || replace(r.qual, 'is_admin()', 'is_admin_or_gerente()') || ')' else '' end;
    v_check := case when r.with_check is not null then 'with check (' || replace(r.with_check, 'is_admin()', 'is_admin_or_gerente()') || ')' else '' end;
    execute format('alter policy %I on %I.%I %s %s', r.policyname, r.schemaname, r.tablename, v_using, v_check);
  end loop;
end $$;

-- 2) Telas só de leitura pro gerente (consumo de bar e frigobar, detalhe de
-- serviço, comissões): políticas novas apenas de SELECT.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bar_comandas', 'bar_comanda_items', 'room_bills', 'room_bill_minibar_items',
    'daily_room_task_occurrence_photos'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_gerente_select', t);
    execute format('create policy %I on %I for select using (is_gerente())', t || '_gerente_select', t);
  end loop;
end $$;

-- 3) Nota de qualidade de uma camareira (comissões): o gerente não pode editar
-- o perfil inteiro (senão poderia mudar o próprio papel), só esta nota.
create or replace function set_service_quality_score(p_id uuid, p_score int) returns void as $$
begin
  if not is_admin_or_gerente() then
    raise exception 'not authorized';
  end if;
  if p_score < 0 or p_score > 10 then
    raise exception 'Nota inválida.';
  end if;
  update profiles set service_quality_score = p_score where id = p_id and role = 'camareira';
end;
$$ language plpgsql security definer;

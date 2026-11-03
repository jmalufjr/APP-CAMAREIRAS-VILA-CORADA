-- 088: o gerente operacional também gerencia as "Listas operacionais" (itens dos checklists,
-- ocorrências de manutenção, manutenção preventiva, suítes, cardápios de frigobar e bar da
-- piscina, layout das mesas). Mesmo método da 082: as políticas que hoje valem só pro admin
-- passam a valer também pro gerente. Exceção deliberada: APAGAR uma suíte continua só do admin
-- (apaga em cascata o histórico daquela suíte).
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
      and tablename in (
        'checklist_items', 'room_checklist_items', 'occurrence_categories',
        'maintenance_categories', 'maintenance_items', 'rooms',
        'minibar_items', 'poolbar_items', 'breakfast_tables'
      )
      and policyname <> 'rooms_admin_delete'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%is_admin()%'
  loop
    v_using := case when r.qual is not null then 'using (' || replace(r.qual, 'is_admin()', 'is_admin_or_gerente()') || ')' else '' end;
    v_check := case when r.with_check is not null then 'with check (' || replace(r.with_check, 'is_admin()', 'is_admin_or_gerente()') || ')' else '' end;
    execute format('alter policy %I on %I.%I %s %s', r.policyname, r.schemaname, r.tablename, v_using, v_check);
  end loop;
end $$;

-- Funções de reordenação e de recálculo de datas da manutenção preventiva: trocam a checagem
-- "é admin" por "é admin ou gerente".
do $$
declare
  f record;
begin
  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('reorder_checklist_items', 'reorder_maintenance_items', 'recompute_category_schedule', 'recompute_item_schedule')
      and p.prosrc like '%is_admin()%'
  loop
    execute replace(f.def, 'is_admin()', 'is_admin_or_gerente()');
  end loop;
end $$;

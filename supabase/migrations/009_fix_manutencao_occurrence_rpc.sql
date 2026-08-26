-- ============================================================================
-- Correção: a policy de UPDATE combinada (seleciona -> resolve) em uma única
-- regra de RLS não estava passando no "with check" do Postgres ao tentar
-- marcar uma ocorrência como resolvida. Troca por duas funções
-- security definer (mesmo padrão de is_admin()/is_manutencao()), que fazem a
-- validação de autorização explicitamente e não dependem da combinação de
-- múltiplas policies permissivas na mesma tabela.
-- Pode ser rodada de uma vez só (não precisa de duas etapas).
-- ============================================================================

drop policy if exists "drto_manutencao_update" on daily_room_task_occurrences;

create or replace function select_occurrence(occ_id uuid) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update daily_room_task_occurrences
  set status = 'selecionada', selected_by = auth.uid(), selected_at = now()
  where id = occ_id and status = 'pendente';
end;
$$ language plpgsql security definer;

create or replace function resolve_occurrence(occ_id uuid) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update daily_room_task_occurrences
  set status = 'resolvida', resolved_by = auth.uid(), resolved_at = now()
  where id = occ_id and selected_by = auth.uid();
end;
$$ language plpgsql security definer;

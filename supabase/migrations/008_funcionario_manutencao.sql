-- ============================================================================
-- Migração: papel "Funcionário de Manutenção" + ciclo de vida das ocorrências
-- de manutenção (pendente -> selecionada -> resolvida).
-- IMPORTANTE: o Postgres não permite usar um valor de enum recém-criado na
-- mesma transação/execução em que ele foi adicionado. Rode a ETAPA 1,
-- espere terminar, e só depois rode a ETAPA 2 em uma nova execução.
-- ============================================================================

-- ---------- ETAPA 1 (rode sozinha, clique em "Run") ----------
alter type user_role add value 'manutencao';


-- ---------- ETAPA 2 (rode depois, em uma nova execução) ----------

create type occurrence_status as enum ('pendente', 'selecionada', 'resolvida');

alter table daily_room_task_occurrences
  add column status occurrence_status not null default 'pendente',
  add column selected_by uuid references profiles(id) on delete set null,
  add column selected_at timestamptz,
  add column resolved_by uuid references profiles(id) on delete set null,
  add column resolved_at timestamptz;

create or replace function is_manutencao() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'manutencao' and active = true
  );
$$ language sql security definer stable;

create policy "profiles_manutencao_select_camareiras" on profiles for select
  using (is_manutencao() and role in ('camareira', 'manutencao'));

create policy "drt_manutencao_select" on daily_room_tasks for select
  using (is_manutencao());

create policy "drto_manutencao_select" on daily_room_task_occurrences for select
  using (is_manutencao() and status <> 'resolvida');
create policy "drto_manutencao_update" on daily_room_task_occurrences for update
  using (is_manutencao() and (status = 'pendente' or selected_by = auth.uid()))
  with check (
    is_manutencao()
    and (
      (status = 'selecionada' and selected_by = auth.uid())
      or (status = 'resolvida' and selected_by = auth.uid() and resolved_by = auth.uid())
    )
  );

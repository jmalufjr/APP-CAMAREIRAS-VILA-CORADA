-- ============================================================================
-- Migração: camareira escolhe o próprio quarto (em vez de o admin atribuir)
-- Execute no SQL Editor do Supabase do seu projeto já existente.
-- ============================================================================

-- Permite que qualquer camareira veja as tarefas do dia que ainda não têm
-- responsável (para poder escolher uma).
create policy "drt_camareira_select_available" on daily_room_tasks for select
  using (assigned_to is null);

-- Permite que uma camareira "reivindique" uma tarefa sem responsável,
-- desde que o resultado da atualização seja ela própria como responsável.
create policy "drt_camareira_claim" on daily_room_tasks for update
  using (assigned_to is null)
  with check (assigned_to = auth.uid());

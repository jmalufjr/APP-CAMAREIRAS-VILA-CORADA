-- ============================================================================
-- Migração: cancelamento de serviços pendentes de dias anteriores (não
-- reivindicados por nenhuma camareira).
-- IMPORTANTE: o Postgres não permite usar um valor de enum recém-criado na
-- mesma transação/execução em que ele foi adicionado. Rode a ETAPA 1,
-- espere terminar, e só depois rode a ETAPA 2 em uma nova execução.
-- ============================================================================

-- ---------- ETAPA 1 (rode sozinha, clique em "Run") ----------
alter type task_status add value 'cancelado';


-- ---------- ETAPA 2 (rode depois, em uma nova execução) ----------

alter table daily_room_tasks add column cancelled_by uuid references profiles(id) on delete set null;
alter table daily_room_tasks add column cancelled_at timestamptz;

-- Cancela um serviço pendente (dia anterior) ainda não reivindicado por
-- ninguém. Usa função security definer (em vez de mais uma policy de UPDATE
-- na mesma tabela, que já tem drt_camareira_update_own/drt_camareira_claim)
-- para não repetir o problema já documentado de policies de UPDATE
-- combinadas cobrindo mais de uma transição de estado na mesma tabela.
create or replace function cancel_daily_room_task(p_task_id uuid) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  update daily_room_tasks
  set status = 'cancelado', cancelled_by = auth.uid(), cancelled_at = now()
  where id = p_task_id and status = 'pendente' and assigned_to is null;
end;
$$ language plpgsql security definer;

-- Avaliação da Inteligência Artificial de uma ocorrência de manutenção (guardada para não gastar a IA a cada abertura).
alter table daily_room_task_occurrences add column if not exists ai_assessment jsonb;
alter table daily_room_task_occurrences add column if not exists ai_assessed_at timestamptz;

-- Só o servidor (chave de serviço) grava a avaliação: qualquer escrita feita por usuário logado (camareira, manutenção etc.)
-- não consegue criar nem alterar estas duas colunas.
create or replace function protect_occurrence_ai_columns() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.ai_assessment := null;
      new.ai_assessed_at := null;
    else
      new.ai_assessment := old.ai_assessment;
      new.ai_assessed_at := old.ai_assessed_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists occurrence_protect_ai_columns on daily_room_task_occurrences;
create trigger occurrence_protect_ai_columns
  before insert or update on daily_room_task_occurrences
  for each row execute function protect_occurrence_ai_columns();

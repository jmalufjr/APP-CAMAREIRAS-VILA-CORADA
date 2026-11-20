-- Limite de chamadas à IA por ocorrência: a vaga é reservada de forma atômica (ver src/lib/occurrence-ai.ts).
alter table daily_room_task_occurrences add column if not exists ai_requested_at timestamptz;

create or replace function protect_occurrence_ai_columns() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.ai_assessment := null;
      new.ai_assessed_at := null;
      new.ai_requested_at := null;
    else
      new.ai_assessment := old.ai_assessment;
      new.ai_assessed_at := old.ai_assessed_at;
      new.ai_requested_at := old.ai_requested_at;
    end if;
  end if;
  return new;
end;
$$;

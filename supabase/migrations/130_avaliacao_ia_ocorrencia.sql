-- Avaliação da Inteligência Artificial de uma ocorrência de manutenção (guardada para não gastar a IA a cada abertura).
alter table daily_room_task_occurrences add column if not exists ai_assessment jsonb;
alter table daily_room_task_occurrences add column if not exists ai_assessed_at timestamptz;

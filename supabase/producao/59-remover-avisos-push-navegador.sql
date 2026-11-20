-- Remove as tabelas do aviso push do navegador (substituído pelo Telegram). Rode só DEPOIS de o código novo estar no ar.
-- A coluna daily_room_task_occurrences.push_notified_at CONTINUA em uso (marca o primeiro aviso, agora do Telegram).
drop table if exists push_alerts;
drop table if exists push_subscriptions;

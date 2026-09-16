-- Mesmo mecanismo de "regra de preferência" (PRD_regrasdenegocio.md seção 1)
-- já usado nas demais tabelas sincronizáveis, agora também na alocação
-- suíte<->mesa: quando o admin atribui/move uma suíte manualmente, essa
-- linha passa a ser ignorada pela sincronização automática (ver
-- PRD_regrasdenegocio.md seção 5 e CLAUDE.md Parte 13).
alter table daily_breakfast_room_assignments add column stays_locked boolean not null default false;

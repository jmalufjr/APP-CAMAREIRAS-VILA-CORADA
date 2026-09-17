-- "Início" de um serviço = o momento em que a camareira reivindicou
-- (clicou "Escolher") a tarefa — diferente de started_at, que marca o
-- primeiro toque em um item do checklist. Usada junto com finished_at
-- (já existente) para calcular "Duração" no Resumo Executivo e "Duração
-- média" no Histórico > Por camareira.
alter table daily_room_tasks add column claimed_at timestamptz;

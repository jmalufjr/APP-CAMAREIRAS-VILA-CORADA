-- "Total de mesas" deixou de ser um valor manual: agora reflete sempre a
-- quantidade de mesas ocupadas (com pelo menos 1 hóspede alocado),
-- calculada na hora a partir de daily_breakfast_room_assignments —
-- `computeTableSizeCounts` (ver CLAUDE.md Parte 17), mesmo tratamento já
-- dado aos outros 4 campos de contagem na Parte 16.
alter table daily_breakfast_settings drop column total_tables;

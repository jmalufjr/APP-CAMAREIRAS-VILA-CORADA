-- Os 4 campos de contagem por tamanho de mesa (tables_1_guest/
-- tables_2_guest/tables_3_guest/guests_table_07, adicionados na migration
-- 029) e seu stays_locked deixaram de ser sincronizados/editáveis à parte
-- (ver CLAUDE.md Parte 16): agora são sempre calculados na hora, direto da
-- alocação suíte↔mesa (`daily_breakfast_room_assignments`), tanto na tela
-- do admin quanto na da camareira. As colunas nunca chegaram a ser
-- realmente usadas por um admin (só por código de sincronização, já
-- removido), então é seguro derrubá-las.
alter table daily_breakfast_settings drop column tables_1_guest;
alter table daily_breakfast_settings drop column tables_2_guest;
alter table daily_breakfast_settings drop column tables_3_guest;
alter table daily_breakfast_settings drop column guests_table_07;
alter table daily_breakfast_settings drop column stays_locked;

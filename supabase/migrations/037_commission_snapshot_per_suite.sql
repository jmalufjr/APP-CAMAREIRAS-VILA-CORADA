-- Congela o valor da comissão por café servido no momento em que cada
-- suíte é alocada a uma mesa (sincronização automática/forçada ou escolha
-- manual do admin) — o mesmo papel que value_per_table_snapshot cumpria em
-- daily_breakfast antes da comissão passar a ser por suíte servida, não
-- por mesa. Meses já fechados no Histórico usam esse valor congelado; o
-- mês corrente sempre usa o valor atual do campo (ver CLAUDE.md).
alter table daily_breakfast_room_assignments
  add column commission_value_snapshot numeric(10,2) not null default 0;

-- Backfill das linhas já existentes (todas de setembro/2026, mês ainda em
-- curso na época desta migration) com o valor atual — não há como saber
-- retroativamente se o valor já foi outro antes disso.
update daily_breakfast_room_assignments
set commission_value_snapshot = coalesce((select value_per_table from commission_settings where id = 1), 10.00)
where commission_value_snapshot = 0;

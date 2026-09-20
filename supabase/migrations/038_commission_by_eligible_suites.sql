-- Reverte parte da migration 037: a comissão não depende mais da alocação
-- de suítes em mesas (podia subcontar em caso de superlotação real ou de
-- lápide de exclusão) — passa a depender só da quantidade de suítes
-- elegíveis pro café da manhã naquele dia, segundo a mesma regra já usada
-- pra ocupá-las nas mesas (checkInDate < data <= checkOutDate),
-- independente de terem sido de fato alocadas a uma mesa. Por isso o
-- retrato passa a ser por dia (não por suíte) em daily_breakfast_settings.
alter table daily_breakfast_room_assignments drop column commission_value_snapshot;

alter table daily_breakfast_settings
  add column eligible_suites_count int not null default 0,
  add column commission_value_snapshot numeric(10,2) not null default 0;

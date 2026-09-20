-- A migration 038 deu default 0 pra eligible_suites_count, o que zerava
-- silenciosamente a comissão exibida no Histórico pra qualquer data
-- anterior à sincronização com a nova regra (0 é indistinguível de
-- "nunca sincronizado sob a regra nova"). Corrige tornando a coluna
-- anulável: null passa a significar explicitamente "sem dado sob a regra
-- nova" — a aplicação cai de volta pra regra antiga (contagem de
-- daily_breakfast_room_assignments) nesse caso, em vez de mostrar zero.
alter table daily_breakfast_settings
  alter column eligible_suites_count drop not null,
  alter column eligible_suites_count drop default;

-- Nenhuma linha até agora foi de fato sincronizada com valor zero de
-- verdade sob a regra nova (a sincronização só tocou hoje/amanhã, ambos
-- com suítes ocupadas) — então todo 0 existente é "nunca sincronizado",
-- não "zero de verdade", e vira null com segurança.
update daily_breakfast_settings
set eligible_suites_count = null
where eligible_suites_count = 0;

-- 087: Ticket médio de canais — novas colunas para o "ticket médio cadastrado": o preço
-- cadastrado (preço base da Stays) das MESMAS diárias reservadas usadas no ticket cobrado,
-- para comparar o cobrado com o cadastrado numa base de dias idêntica.
--  registered_total = soma do preço base de cada diária reservada que tem preço cadastrado
--  matched_nights   = quantas diárias reservadas têm preço cadastrado (ex.: dias já passados do
--                     mês corrente não têm preço na Stays)
--  matched_charged  = valor cobrado exatamente nessas mesmas diárias
alter table channel_ticket_stats
  add column if not exists registered_total numeric not null default 0,
  add column if not exists matched_nights integer not null default 0,
  add column if not exists matched_charged numeric not null default 0;

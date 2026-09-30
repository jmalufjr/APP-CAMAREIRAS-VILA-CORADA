-- Nome do hóspede em daily_departures, sincronizável com a Stays (mesmo
-- padrão de daily_arrivals.guest_name) — até aqui a coluna "Saídas" só
-- mostrava o número da suíte, sem o nome de quem está saindo, diferente
-- da coluna "Chegadas". Nullable: contas antigas de antes desta parte, ou
-- uma saída cadastrada manualmente sem nome informado, continuam válidas.
alter table daily_departures add column if not exists guest_name text;

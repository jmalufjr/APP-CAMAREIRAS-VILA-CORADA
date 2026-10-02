-- "Boleto" como forma de pagamento adicional — usado pelo módulo de
-- compras/despesas (fornecedor pode ter sido pago por boleto, diferente
-- das 5 formas já existentes pra pagamento de hóspede). Precisa rodar
-- sozinho, numa migration própria: o Postgres não permite usar um valor
-- de enum recém-criado na mesma transação em que foi adicionado (mesmo
-- motivo já documentado em 003_troca_task_type.sql).
alter type payment_method add value if not exists 'boleto';

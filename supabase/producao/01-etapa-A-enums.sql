-- ETAPA A (rodar PRIMEIRO, sozinha, no SQL Editor do Supabase de PRODUÇÃO)
-- Acrescenta dois valores de enum. O Postgres não deixa usar um valor de enum
-- recém-criado na mesma transação em que foi criado, por isso esta etapa é
-- separada da B. É segura de repetir (if not exists).

alter type payment_method add value if not exists 'boleto';
alter type user_role add value if not exists 'gerente_operacional';

-- 081: novo papel "gerente operacional" (só o valor do enum — o Postgres não deixa
-- usar um valor de enum recém-criado na mesma transação; as regras de acesso
-- ficam na migration 082).
alter type user_role add value if not exists 'gerente_operacional';

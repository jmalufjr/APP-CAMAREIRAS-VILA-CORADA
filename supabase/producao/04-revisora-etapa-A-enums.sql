-- 083: novos estados do serviço da camareira (camareira revisora) — só os valores
-- do enum; o Postgres não deixa usar um valor de enum recém-criado na mesma
-- transação, então as regras ficam na migration 084 (PRD_camareira_revisora.md).
alter type task_status add value if not exists 'aguardando_revisao';
alter type task_status add value if not exists 'em_revisao';
alter type task_status add value if not exists 'aguardando_correcao';
alter type task_status add value if not exists 'em_correcao';

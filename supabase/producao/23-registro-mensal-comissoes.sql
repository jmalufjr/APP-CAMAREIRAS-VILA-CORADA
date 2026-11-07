-- Registro mensal das comissoes: valores congelados de cada mes encerrado (alem do mes anterior).
alter table commission_statements
  add column if not exists bar_amount numeric(10,2) not null default 0,
  add column if not exists frozen_at timestamptz;

-- Gerente operacional tambem le as notas e o registro mensal.
drop policy if exists cst_gerente_select on commission_statements;
create policy cst_gerente_select on commission_statements for select using (is_admin_or_gerente());

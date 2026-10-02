-- Frequência de contagem física configurável por categoria (ex.: mensal
-- pra limpeza, trimestral pra enxoval) — usada só pra calcular o aviso
-- "está na hora de contar de novo" na tela de Contagem de estoque. Null
-- (padrão) significa "sem lembrete configurado" — nunca obrigatório.
alter table expense_categories
  add column count_frequency_days integer check (count_frequency_days is null or count_frequency_days > 0);

-- Prazo de consumo individual de cada ingrediente (categoria Alimentos).
-- Padrao 30 dias; todos os ingredientes ja cadastrados passam a ter 30 dias ate serem ajustados.
alter table ingredients add column if not exists consumption_days int not null default 30
  check (consumption_days between 1 and 365);

-- Conferencia
select name, consumption_days from ingredients order by name;

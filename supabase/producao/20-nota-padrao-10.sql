-- Nota de qualidade: o padrao passa a ser 10 (nota 10 = comissao inteira).
alter table profiles alter column service_quality_score set default 10;
-- Camareiras que ainda estao na nota 5 (o antigo padrao) passam para 10.
update profiles set service_quality_score = 10 where role = 'camareira' and service_quality_score = 5;

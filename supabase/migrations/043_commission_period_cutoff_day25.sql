-- Comissão de serviços nas suítes e no café: o fechamento deixou de
-- acompanhar o mês calendário e passou a fechar sempre no dia 25 (não no
-- último dia do mês), pra dar tempo de conferir e calcular antes do mês
-- virar (ver closedPeriodRange em src/lib/commission-math.ts). A coluna
-- que guardava o primeiro dia do mês calendário agora guarda a data de
-- fechamento do período (sempre um dia 25) — renomeada de "month" pra
-- "period_end" pra não ficar enganosa.
alter table commission_statements rename column month to period_end;

-- Linhas já calculadas sob a regra antiga (mês calendário) não
-- correspondem a nenhum período da regra nova — descartadas pra forçar
-- um recálculo limpo do último período fechado na próxima vez que o
-- admin clicar em "Calcular". A nota de cada camareira (profiles.
-- service_quality_score, já editada de verdade em produção) não é
-- afetada por este delete — só o valor calculado em R$ é descartado, e
-- é recalculado a partir da nota atual assim que o botão for clicado de
-- novo.
delete from commission_statements;

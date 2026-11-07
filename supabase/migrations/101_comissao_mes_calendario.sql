-- Mes anterior passa a ser o mes calendario (01 a 31). As notas ja gravadas tinham period_end no dia 25
-- do mes; passam para o ultimo dia desse mesmo mes (mesmo mes de referencia).
update commission_statements
set period_end = (date_trunc('month', period_end) + interval '1 month' - interval '1 day')::date
where extract(day from period_end) = 25;

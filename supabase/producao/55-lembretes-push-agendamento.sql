-- Lembretes dos avisos de ocorrência: a cada 5 minutos o banco chama o app, que reenvia o aviso de toda ocorrência
-- pendente cuja notificação ainda não foi dispensada.
--
-- ANTES de rodar: troque COLE_AQUI_O_CRON_SECRET pelo valor da variável PUSH_CRON_SECRET (uma senha própria dos avisos,
-- criada na Vercel; o CRON_SECRET do cron da Stays não é reutilizado). Não envie esse valor a ninguém.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'lembretes-push-ocorrencias',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://app-camareiras-vila-corada.vercel.app/api/cron/push-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_CRON_SECRET')
  );
  $$
);

-- Para parar os lembretes no futuro:  select cron.unschedule('lembretes-push-ocorrencias');

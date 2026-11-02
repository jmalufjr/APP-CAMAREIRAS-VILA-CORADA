-- 086: Ticket médio de canais de venda — cada suíte passa a ser o seu próprio grupo
-- (s1 a s11) em vez de 4 grupos de suítes (g1 a g4), porque os preços cadastrados na Stays
-- diferem entre as suítes do mesmo grupo. As linhas antigas são descartadas; a próxima
-- sincronização com a Stays regrava tudo.
alter table channel_ticket_stats drop constraint if exists channel_ticket_stats_group_key_check;
delete from channel_ticket_stats where group_key like 'g%';
alter table channel_ticket_stats
  add constraint channel_ticket_stats_group_key_check check (group_key ~ '^s([1-9]|1[01])$');

-- Indicadores: comissao real informada pela Stays em cada reserva (R$), repartida entre as diarias.
-- Depois de rodar, use "Atualizar historico completo" na tela Indicadores para preencher os meses antigos.
alter table indicator_month_channels
  add column if not exists commission_actual numeric(14,2) not null default 0,
  add column if not exists revenue_with_commission numeric(14,2) not null default 0;

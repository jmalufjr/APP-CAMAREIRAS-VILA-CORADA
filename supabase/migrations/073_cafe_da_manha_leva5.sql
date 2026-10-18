-- Módulo Contábil — Leva 5: fórmula de custo do café da manhã. Ver
-- PRD_compras&contabil.md seção 27 e seção 22.3 itens 9/10.

-- "É perecível?" — editável pelo admin, nunca uma lista fixa de nomes
-- (itens perecíveis entram no custo pelo total COMPRADO no período;
-- não-perecíveis entram pelo total BAIXADO manualmente, valorizado pelo
-- custo médio — ver getBreakfastCostForPeriod). Padrão false pra todo
-- item já existente: decisão deliberada de não adivinhar por nome (ex.:
-- "ovo", "fruta") — o admin revisa e marca manualmente os itens
-- relevantes do café da manhã depois do deploy.
alter table inventory_items add column is_perishable boolean not null default false;

-- "Cafés servidos" — um número por DIA (não por suíte). null = usa o
-- total de hóspedes hospedados (soma de daily_breakfast_room_assignments.
-- guest_count) calculado na hora; um valor aqui é sempre um TETO que só
-- pode ser reduzido, nunca aumentado (ver setBreakfastGuestsServed) —
-- nunca persiste o total calculado em si, só o override pra baixo.
alter table daily_breakfast_settings add column guests_served int;

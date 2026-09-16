-- ============================================================================
-- Migração: base de schema para a integração com a API de reservas da
-- Stays (ver PRD_regrasdenegocio.md). Só mudanças aditivas (colunas novas,
-- todas com default), sem novo valor de enum — pode rodar tudo de uma vez,
-- sem separar em etapas.
-- ============================================================================

-- Mapeamento quarto -> listing da Stays (ver README.md seção 6.3 para como
-- foi obtido). Cada quarto corresponde a exatamente 1 listing.
alter table rooms add column stays_listing_id text unique;

update rooms set stays_listing_id = '678819a8124ceee95d3c8cbb' where number = '1';
update rooms set stays_listing_id = '67881a5c124ceee95d3cbce1' where number = '2';
update rooms set stays_listing_id = '67881ab1124ceee95d3cc7df' where number = '3';
update rooms set stays_listing_id = '678819d7124ceee95d3ca954' where number = '4';
update rooms set stays_listing_id = '67881a1d124ceee95d3cb3db' where number = '5';
update rooms set stays_listing_id = '6959646daa13087cea0dd641' where number = '6';
update rooms set stays_listing_id = '69596751edd71eb2edcd0eb9' where number = '7';
update rooms set stays_listing_id = '695967a558f32eb9e9504533' where number = '8';
update rooms set stays_listing_id = '6959686485b3e44854919dbd' where number = '9';
update rooms set stays_listing_id = '68dc80e6c2c8bc52936d4c73' where number = '10';
update rooms set stays_listing_id = '68d2dc4d4a55c587e7aef195' where number = '11';

-- ---------- Colunas "stays_locked" (regra de preferência do PRD, seção 1) ----------
-- Quando true, a rotina de sincronização não sobrescreve a linha: o admin
-- editou manualmente algum campo sincronizável daquele dia/quarto (ou
-- dia/mesa), então essa edição tem preferência. Marcado pelas próprias
-- Server Actions de edição do admin; a rotina de sync só grava quando
-- stays_locked = false (e, ao criar a linha a partir da Stays, mantém
-- false, já que é o valor padrão).

alter table daily_room_tasks add column stays_locked boolean not null default false;
alter table daily_departures add column stays_locked boolean not null default false;
alter table daily_breakfast add column stays_locked boolean not null default false;

-- daily_arrivals: "quantidade de noites" e "quantidade de hóspedes" são
-- campos novos, sincronizáveis (ver PRD seção 3). "horário previsto" e
-- "observações" continuam existindo mas NUNCA são tocados pela
-- sincronização (não precisam de lock próprio).
alter table daily_arrivals add column nights int;
alter table daily_arrivals add column guest_count int;
alter table daily_arrivals add column stays_locked boolean not null default false;

-- daily_breakfast_settings: quatro campos novos depois de "total de mesas"
-- (ver PRD seção 4) — "valor da comissão"/"observações do dia" já existem
-- em outras tabelas e nunca são tocados pela sincronização.
alter table daily_breakfast_settings add column tables_1_guest int not null default 0;
alter table daily_breakfast_settings add column tables_2_guest int not null default 0;
alter table daily_breakfast_settings add column tables_3_guest int not null default 0;
alter table daily_breakfast_settings add column guests_table_07 int not null default 0;
alter table daily_breakfast_settings add column stays_locked boolean not null default false;

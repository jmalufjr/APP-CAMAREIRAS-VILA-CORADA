-- Tipo de cada ingrediente: alimento | bebida_quente | demais_bebidas.
-- Alimentos (inclusive cafes) tem prazo de consumo e rateio proprios; as bebidas seguem
-- o prazo e o rateio da propria categoria (Bebidas quentes / Demais bebidas).
alter table ingredients add column if not exists kind text not null default 'alimento'
  check (kind in ('alimento','bebida_quente','demais_bebidas'));

-- Bebidas quentes: destilados, vinhos e outras alcoolicas que nao sao cerveja
update ingredients set kind = 'bebida_quente'
where name ilike '%cacha%' or name ilike '%vodka%' or name ilike 'gin%' or name ilike '% gin%'
   or name ilike 'gim%' or name ilike '% gim%' or name ilike '%campari%' or name ilike '%whisk%'
   or name ilike '%u_sque%' or name ilike '%vinho%' or name ilike '%licor%' or name ilike 'rum%'
   or name ilike '% rum%' or name ilike '%tequila%' or name ilike '%aperol%' or name ilike '%espumante%'
   or name ilike '%vermute%' or name ilike '%conhaque%';

-- Demais bebidas: cervejas, aguas (inclusive de coco e tonica) e refrigerantes
update ingredients set kind = 'demais_bebidas'
where kind = 'alimento'
  and (name ilike '%cerveja%' or name ilike '%_gua %' or name ilike '%_gua' or name ilike '%refrigerante%'
       or name ilike '%coca%' or name ilike '%guaran%' or name ilike '%t_nica%' or name ilike '%soda%'
       or name ilike '%heineken%');

-- Conferencia: como ficou cada ingrediente (corrija na tela se algum estiver no tipo errado)
select kind, name from ingredients order by kind, name;

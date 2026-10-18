-- Plano de contas inicial (ver PRD_compras.md seção 21): 4 centros, 25
-- subcentros, ~250 vínculos item↔subcentro. Rateio inicial sempre em
-- partes iguais entre os subcentros de que cada item participa
-- (confirmado com o proprietário) — ex.: item em 3 subcentros recebe
-- 34/33/33 (o 1% de resto sempre vai pro primeiro, em ordem alfabética,
-- só pra garantir soma exata de 100).

create temp table raw_items (item_name text, is_inventory boolean, subcenter_name text, center_name text);

insert into raw_items (item_name, is_inventory, subcenter_name, center_name) values
-- ===== HOSPEDAGEM =====
('água', false, 'Gerais', 'Hospedagem'),
('luz', false, 'Gerais', 'Hospedagem'),
('internet', false, 'Gerais', 'Hospedagem'),
('dedetização', false, 'Gerais', 'Hospedagem'),
('limpeza coqueiros', false, 'Gerais', 'Hospedagem'),
('impostos e taxas', false, 'Gerais', 'Hospedagem'),

('amenities', true, 'Materiais das suítes', 'Hospedagem'),
('travesseiros', true, 'Materiais das suítes', 'Hospedagem'),
('papel higiênico', true, 'Materiais das suítes', 'Hospedagem'),
('sacos de lixo', true, 'Materiais das suítes', 'Hospedagem'),
('secador de cabelo', true, 'Materiais das suítes', 'Hospedagem'),

('toalhas de banho', true, 'Enxoval de cama e banho', 'Hospedagem'),
('toalhas de rosto', true, 'Enxoval de cama e banho', 'Hospedagem'),
('lençóis', true, 'Enxoval de cama e banho', 'Hospedagem'),
('fronhas', true, 'Enxoval de cama e banho', 'Hospedagem'),
('capas protetoras de travesseiro', true, 'Enxoval de cama e banho', 'Hospedagem'),
('capas protetoras de colchão', true, 'Enxoval de cama e banho', 'Hospedagem'),

('salário dos funcionários de manutenção', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('salário das camareiras', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('encargos', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('cesta básica', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('plano de saúde', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('transporte', false, 'Mão de obra de hospedagem', 'Hospedagem'),

('outros materiais de jardinagem', false, 'Materiais de Jardim', 'Hospedagem'),
('adubo', false, 'Materiais de Jardim', 'Hospedagem'),
('plantas', false, 'Materiais de Jardim', 'Hospedagem'),
('remédios de plantas', false, 'Materiais de Jardim', 'Hospedagem'),
('mangueiras', false, 'Materiais de Jardim', 'Hospedagem'),
('conectores de mangueiras', false, 'Materiais de Jardim', 'Hospedagem'),
('torneiras de jardim', false, 'Materiais de Jardim', 'Hospedagem'),
('aspersores', false, 'Materiais de Jardim', 'Hospedagem'),
('outros materiais de irrigação', false, 'Materiais de Jardim', 'Hospedagem'),

('outros materiais de piscina', true, 'Materiais de Piscina', 'Hospedagem'),
('cloro', true, 'Materiais de Piscina', 'Hospedagem'),
('clarificante', true, 'Materiais de Piscina', 'Hospedagem'),
('barrilha', true, 'Materiais de Piscina', 'Hospedagem'),
('pastilhas de cloro', true, 'Materiais de Piscina', 'Hospedagem'),
('fluidos de medidores', true, 'Materiais de Piscina', 'Hospedagem'),
('toalhas de piscina', true, 'Materiais de Piscina', 'Hospedagem'),

('outros materiais de manutenção', false, 'Materiais de Manutenção', 'Hospedagem'),
('lâmpadas', true, 'Materiais de Manutenção', 'Hospedagem'),
('fita isolante', true, 'Materiais de Manutenção', 'Hospedagem'),
('fita veda rosca', true, 'Materiais de Manutenção', 'Hospedagem'),
('cola de cano', true, 'Materiais de Manutenção', 'Hospedagem'),
('silicone', true, 'Materiais de Manutenção', 'Hospedagem'),
('lubrificantes', true, 'Materiais de Manutenção', 'Hospedagem'),
('antioxidantes', true, 'Materiais de Manutenção', 'Hospedagem'),
('lixas', false, 'Materiais de Manutenção', 'Hospedagem'),
('peças de reposição', true, 'Materiais de Manutenção', 'Hospedagem'),
('parafusos', false, 'Materiais de Manutenção', 'Hospedagem'),
('porcas', false, 'Materiais de Manutenção', 'Hospedagem'),
('prendedores de toldo', false, 'Materiais de Manutenção', 'Hospedagem'),
('fio elétrico', false, 'Materiais de Manutenção', 'Hospedagem'),
('tomadas', true, 'Materiais de Manutenção', 'Hospedagem'),
('interruptores', true, 'Materiais de Manutenção', 'Hospedagem'),
('outros materiais elétricos', true, 'Materiais de Manutenção', 'Hospedagem'),
('outros materiais hidráulicos', true, 'Materiais de Manutenção', 'Hospedagem'),
('rejunte', false, 'Materiais de Manutenção', 'Hospedagem'),
('tintas de parede', true, 'Materiais de Manutenção', 'Hospedagem'),
('cimento', false, 'Materiais de Manutenção', 'Hospedagem'),
('argamassa', false, 'Materiais de Manutenção', 'Hospedagem'),
('areia', false, 'Materiais de Manutenção', 'Hospedagem'),
('colas em geral', false, 'Materiais de Manutenção', 'Hospedagem'),
('impermeabilizantes', false, 'Materiais de Manutenção', 'Hospedagem'),
('cabos', false, 'Materiais de Manutenção', 'Hospedagem'),
('filtros', false, 'Materiais de Manutenção', 'Hospedagem'),
('conduites', false, 'Materiais de Manutenção', 'Hospedagem'),
('conectores em geral', false, 'Materiais de Manutenção', 'Hospedagem'),
('conexões hidráulicas', false, 'Materiais de Manutenção', 'Hospedagem'),
('canos', false, 'Materiais de Manutenção', 'Hospedagem'),
('eletrodutos', false, 'Materiais de Manutenção', 'Hospedagem'),
('telhas', false, 'Materiais de Manutenção', 'Hospedagem'),
('carrinho de mão', true, 'Materiais de Manutenção', 'Hospedagem'),
('sacos de lixo', true, 'Materiais de Manutenção', 'Hospedagem'),
('escovão', false, 'Materiais de Manutenção', 'Hospedagem'),
('escada', false, 'Materiais de Manutenção', 'Hospedagem'),
('caibros', false, 'Materiais de Manutenção', 'Hospedagem'),
('ripas', false, 'Materiais de Manutenção', 'Hospedagem'),
('linhas de madeira', false, 'Materiais de Manutenção', 'Hospedagem'),
('toras de eucalipto', false, 'Materiais de Manutenção', 'Hospedagem'),
('tábuas', false, 'Materiais de Manutenção', 'Hospedagem'),
('medidores em geral', false, 'Materiais de Manutenção', 'Hospedagem'),

('alicates', false, 'Ferramentas', 'Hospedagem'),
('chaves de fenda', false, 'Ferramentas', 'Hospedagem'),
('chaves estrela', false, 'Ferramentas', 'Hospedagem'),
('chaves allen', false, 'Ferramentas', 'Hospedagem'),
('martelos', false, 'Ferramentas', 'Hospedagem'),
('chaves inglesas', false, 'Ferramentas', 'Hospedagem'),
('chaves de cano', false, 'Ferramentas', 'Hospedagem'),
('serrinha', false, 'Ferramentas', 'Hospedagem'),
('trenas', false, 'Ferramentas', 'Hospedagem'),
('outras ferramentas de manutenção', false, 'Ferramentas', 'Hospedagem'),

('Stays (CMS)', false, 'Honorários administrativos', 'Hospedagem'),
('Invictos (Comercial e Atendimento)', false, 'Honorários administrativos', 'Hospedagem'),
('Financeiro (Márcia)', false, 'Honorários administrativos', 'Hospedagem'),
('Contabilidade (Simone Perla)', false, 'Honorários administrativos', 'Hospedagem'),
('outras honorários administrativos', false, 'Honorários administrativos', 'Hospedagem'),
('pró-labore', false, 'Honorários administrativos', 'Hospedagem'),

('detergente', true, 'Materiais de limpeza', 'Hospedagem'),
('álcool', true, 'Materiais de limpeza', 'Hospedagem'),
('água sanitária', true, 'Materiais de limpeza', 'Hospedagem'),
('perfume de ambiente', false, 'Materiais de limpeza', 'Hospedagem'),
('desinfetante', true, 'Materiais de limpeza', 'Hospedagem'),
('veja multiuso', true, 'Materiais de limpeza', 'Hospedagem'),
('limpa vidros', true, 'Materiais de limpeza', 'Hospedagem'),
('baldes', true, 'Materiais de limpeza', 'Hospedagem'),
('vassouras', true, 'Materiais de limpeza', 'Hospedagem'),
('rodos', true, 'Materiais de limpeza', 'Hospedagem'),
('panos de limpeza', false, 'Materiais de limpeza', 'Hospedagem'),
('estopas', false, 'Materiais de limpeza', 'Hospedagem'),
('buchas', false, 'Materiais de limpeza', 'Hospedagem'),
('sabão líquido', true, 'Materiais de limpeza', 'Hospedagem'),
('sabão em pó', true, 'Materiais de limpeza', 'Hospedagem'),
('sabão em barra', true, 'Materiais de limpeza', 'Hospedagem'),
('borrifadores', false, 'Materiais de limpeza', 'Hospedagem'),
('outros materiais de limpeza', false, 'Materiais de limpeza', 'Hospedagem'),

-- ===== CAFÉ DA MANHÃ =====
('água', false, 'Gerais', 'Café da manhã'),
('luz', false, 'Gerais', 'Café da manhã'),
('gás', false, 'Gerais', 'Café da manhã'),
('impostos e taxas', false, 'Gerais', 'Café da manhã'),

('frutas', false, 'Alimentos', 'Café da manhã'),
('ovos', false, 'Alimentos', 'Café da manhã'),
('café', true, 'Alimentos', 'Café da manhã'),
('chocolate', true, 'Alimentos', 'Café da manhã'),
('farinha de trigo', true, 'Alimentos', 'Café da manhã'),
('manteiga', true, 'Alimentos', 'Café da manhã'),
('margarina', true, 'Alimentos', 'Café da manhã'),
('requeijão', true, 'Alimentos', 'Café da manhã'),
('cream cheese', true, 'Alimentos', 'Café da manhã'),
('croissants', true, 'Alimentos', 'Café da manhã'),
('pães', true, 'Alimentos', 'Café da manhã'),
('salgadinhos', false, 'Alimentos', 'Café da manhã'),
('brioches', false, 'Alimentos', 'Café da manhã'),
('bolos', false, 'Alimentos', 'Café da manhã'),
('açúcar', true, 'Alimentos', 'Café da manhã'),
('sal', true, 'Alimentos', 'Café da manhã'),
('adoçante', true, 'Alimentos', 'Café da manhã'),
('mel', true, 'Alimentos', 'Café da manhã'),
('legumes', false, 'Alimentos', 'Café da manhã'),
('verduras', false, 'Alimentos', 'Café da manhã'),
('linguiças', true, 'Alimentos', 'Café da manhã'),
('bacon', true, 'Alimentos', 'Café da manhã'),
('queijos', true, 'Alimentos', 'Café da manhã'),
('presuntos', true, 'Alimentos', 'Café da manhã'),
('farinha de tapioca', true, 'Alimentos', 'Café da manhã'),
('farinha de cuscuz', true, 'Alimentos', 'Café da manhã'),
('pimenta', false, 'Alimentos', 'Café da manhã'),
('temperos', false, 'Alimentos', 'Café da manhã'),

('salário das camareiras', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('encargos', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('cesta básica', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('plano de saúde', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('transporte', false, 'Mão de obra de café da manhã', 'Café da manhã'),

('copos', false, 'Materiais de café da manhã', 'Café da manhã'),
('xícaras', false, 'Materiais de café da manhã', 'Café da manhã'),
('pires', false, 'Materiais de café da manhã', 'Café da manhã'),
('pratos', false, 'Materiais de café da manhã', 'Café da manhã'),
('talheres', false, 'Materiais de café da manhã', 'Café da manhã'),
('jogos americanos', false, 'Materiais de café da manhã', 'Café da manhã'),
('panos de prato', false, 'Materiais de café da manhã', 'Café da manhã'),
('guardanapos', false, 'Materiais de café da manhã', 'Café da manhã'),
('papéis toalha', false, 'Materiais de café da manhã', 'Café da manhã'),
('utensílios de cozinha', false, 'Materiais de café da manhã', 'Café da manhã'),

('Stays (CMS)', false, 'Honorários administrativos', 'Café da manhã'),
('Invictos (Comercial e Atendimento)', false, 'Honorários administrativos', 'Café da manhã'),
('Financeiro (Márcia)', false, 'Honorários administrativos', 'Café da manhã'),
('Contabilidade (Simone Perla)', false, 'Honorários administrativos', 'Café da manhã'),
('outras honorários administrativos', false, 'Honorários administrativos', 'Café da manhã'),
('pró-labore', false, 'Honorários administrativos', 'Café da manhã'),

('detergente', true, 'Materiais de limpeza', 'Café da manhã'),
('álcool', true, 'Materiais de limpeza', 'Café da manhã'),
('água sanitária', true, 'Materiais de limpeza', 'Café da manhã'),
('perfume de ambiente', false, 'Materiais de limpeza', 'Café da manhã'),
('desinfetante', true, 'Materiais de limpeza', 'Café da manhã'),
('veja multiuso', true, 'Materiais de limpeza', 'Café da manhã'),
('limpa vidros', true, 'Materiais de limpeza', 'Café da manhã'),
('baldes', true, 'Materiais de limpeza', 'Café da manhã'),
('vassouras', true, 'Materiais de limpeza', 'Café da manhã'),
('rodos', true, 'Materiais de limpeza', 'Café da manhã'),
('panos de limpeza', false, 'Materiais de limpeza', 'Café da manhã'),
('estopas', false, 'Materiais de limpeza', 'Café da manhã'),
('buchas', false, 'Materiais de limpeza', 'Café da manhã'),
('sabão líquido', true, 'Materiais de limpeza', 'Café da manhã'),
('sabão em pó', true, 'Materiais de limpeza', 'Café da manhã'),
('sabão em barra', true, 'Materiais de limpeza', 'Café da manhã'),
('borrifadores', false, 'Materiais de limpeza', 'Café da manhã'),
('outros materiais de limpeza', false, 'Materiais de limpeza', 'Café da manhã'),

-- ===== BAR DE PISCINA =====
('água', false, 'Gerais', 'Bar de piscina'),
('luz', false, 'Gerais', 'Bar de piscina'),
('gás', false, 'Gerais', 'Bar de piscina'),
('impostos e taxas', false, 'Gerais', 'Bar de piscina'),

('manteiga', true, 'Alimentos', 'Bar de piscina'),
('margarina', true, 'Alimentos', 'Bar de piscina'),
('pães', true, 'Alimentos', 'Bar de piscina'),
('açúcar', true, 'Alimentos', 'Bar de piscina'),
('sal', true, 'Alimentos', 'Bar de piscina'),
('adoçante', true, 'Alimentos', 'Bar de piscina'),
('carnes', true, 'Alimentos', 'Bar de piscina'),
('camarões', true, 'Alimentos', 'Bar de piscina'),
('queijos', true, 'Alimentos', 'Bar de piscina'),
('ovos', false, 'Alimentos', 'Bar de piscina'),
('presuntos', true, 'Alimentos', 'Bar de piscina'),
('macaxeira', true, 'Alimentos', 'Bar de piscina'),
('batatas fritas', true, 'Alimentos', 'Bar de piscina'),
('temperos', false, 'Alimentos', 'Bar de piscina'),
('massa de pastel', true, 'Alimentos', 'Bar de piscina'),
('bolinhos de bacalhau', true, 'Alimentos', 'Bar de piscina'),

('Vodka Smirnoff', true, 'Bebidas', 'Bar de piscina'),
('Vodka Absolut', true, 'Bebidas', 'Bar de piscina'),
('Cachaça', true, 'Bebidas', 'Bar de piscina'),
('Campari', true, 'Bebidas', 'Bar de piscina'),
('Gim Tanqueray', true, 'Bebidas', 'Bar de piscina'),
('Água de Coco', true, 'Bebidas', 'Bar de piscina'),
('Água com gás', true, 'Bebidas', 'Bar de piscina'),
('Água sem gás', true, 'Bebidas', 'Bar de piscina'),
('Refrigerante', true, 'Bebidas', 'Bar de piscina'),
('Cerveja', true, 'Bebidas', 'Bar de piscina'),
('Café expresso', true, 'Bebidas', 'Bar de piscina'),

('salário das camareiras', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('encargos', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('cesta básica', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('plano de saúde', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('transporte', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),

('taças', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('palitos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('canudos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('mexedores de drink', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('copos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('pratos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('talheres', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('guardanapos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('papéis toalha', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('utensílios de cozinha', false, 'Materiais de bar da piscina', 'Bar de piscina'),

('Stays (CMS)', false, 'Honorários administrativos', 'Bar de piscina'),
('Invictos (Comercial e Atendimento)', false, 'Honorários administrativos', 'Bar de piscina'),
('Financeiro (Márcia)', false, 'Honorários administrativos', 'Bar de piscina'),
('Contabilidade (Simone Perla)', false, 'Honorários administrativos', 'Bar de piscina'),
('outras honorários administrativos', false, 'Honorários administrativos', 'Bar de piscina'),
('pró-labore', false, 'Honorários administrativos', 'Bar de piscina'),

('detergente', true, 'Materiais de limpeza', 'Bar de piscina'),
('álcool', true, 'Materiais de limpeza', 'Bar de piscina'),
('água sanitária', true, 'Materiais de limpeza', 'Bar de piscina'),
('perfume de ambiente', false, 'Materiais de limpeza', 'Bar de piscina'),
('desinfetante', true, 'Materiais de limpeza', 'Bar de piscina'),
('veja multiuso', true, 'Materiais de limpeza', 'Bar de piscina'),
('limpa vidros', true, 'Materiais de limpeza', 'Bar de piscina'),
('baldes', true, 'Materiais de limpeza', 'Bar de piscina'),
('vassouras', true, 'Materiais de limpeza', 'Bar de piscina'),
('rodos', true, 'Materiais de limpeza', 'Bar de piscina'),
('panos de limpeza', false, 'Materiais de limpeza', 'Bar de piscina'),
('estopas', false, 'Materiais de limpeza', 'Bar de piscina'),
('buchas', false, 'Materiais de limpeza', 'Bar de piscina'),
('sabão líquido', true, 'Materiais de limpeza', 'Bar de piscina'),
('sabão em pó', true, 'Materiais de limpeza', 'Bar de piscina'),
('sabão em barra', true, 'Materiais de limpeza', 'Bar de piscina'),
('borrifadores', false, 'Materiais de limpeza', 'Bar de piscina'),
('outros materiais de limpeza', false, 'Materiais de limpeza', 'Bar de piscina'),

-- ===== FRIGOBAR =====
('luz', false, 'Gerais', 'Frigobar'),
('Água com gás', true, 'Bebidas', 'Frigobar'),
('Água sem gás', true, 'Bebidas', 'Frigobar'),
('Refrigerante', true, 'Bebidas', 'Frigobar'),
('Cerveja', true, 'Bebidas', 'Frigobar'),
('Café expresso', true, 'Bebidas', 'Frigobar');

-- 1) Centros
insert into cost_centers (name, position)
select center_name, row_number() over (order by min(ctid))
from (select center_name, min(ctid) as ctid from raw_items group by center_name) x
group by center_name;
-- (posição aproximada só pra ordem de exibição inicial, reordenável depois)
update cost_centers set position = sub.pos from (
  select name, row_number() over () as pos from (
    select distinct center_name as name from raw_items
  ) t
) sub where cost_centers.name = sub.name;

-- 2) Subcentros (1 linha por par distinto nome+centro, mesmo quando o
-- nome se repete em centros diferentes) + ligação 100% ao seu centro.
create temp table subcenter_map (subcenter_name text, center_name text, subcenter_id uuid);
do $$
declare r record; v_id uuid;
begin
  for r in select distinct subcenter_name, center_name from raw_items order by center_name, subcenter_name loop
    insert into cost_subcenters (name) values (r.subcenter_name) returning id into v_id;
    insert into subcenter_map values (r.subcenter_name, r.center_name, v_id);
  end loop;
end $$;

insert into cost_subcenter_centers (subcenter_id, center_id, alloc_pct)
select sm.subcenter_id, cc.id, 100
from subcenter_map sm join cost_centers cc on cc.name = sm.center_name;

-- 3) Itens de custo — 1 linha por nome distinto; quando representa
-- estoque, liga a um item de estoque já existente (por nome) ou cria um
-- novo (unidade "un" por padrão, editável depois).
create temp table item_map (item_name text, cost_item_id uuid);
do $$
declare r record; v_item_id uuid; v_inv_id uuid;
begin
  for r in select item_name, bool_or(is_inventory) as is_inventory from raw_items group by item_name order by item_name loop
    v_inv_id := null;
    if r.is_inventory then
      select id into v_inv_id from inventory_items where lower(name) = lower(r.item_name) limit 1;
      if v_inv_id is null then
        insert into inventory_items (name, unit) values (r.item_name, 'un') returning id into v_inv_id;
      end if;
    end if;
    insert into cost_items (name, is_inventory, inventory_item_id) values (r.item_name, r.is_inventory, v_inv_id) returning id into v_item_id;
    insert into item_map values (r.item_name, v_item_id);
  end loop;
end $$;

-- 4) Vínculo item↔subcentro, com rateio em partes iguais (resto de
-- arredondamento sempre pro primeiro subcentro, em ordem alfabética, pra
-- garantir soma exata de 100).
insert into cost_item_subcenters (cost_item_id, subcenter_id, alloc_pct)
select
  im.cost_item_id,
  sm.subcenter_id,
  floor(100.0 / cnt.n) + case when rn.rn = 1 then 100 - cnt.n * floor(100.0 / cnt.n) else 0 end
from raw_items ri
join item_map im on im.item_name = ri.item_name
join subcenter_map sm on sm.subcenter_name = ri.subcenter_name and sm.center_name = ri.center_name
join (select item_name, count(*) as n from raw_items group by item_name) cnt on cnt.item_name = ri.item_name
join (
  select item_name, subcenter_name, center_name,
    row_number() over (partition by item_name order by center_name, subcenter_name) as rn
  from raw_items
) rn on rn.item_name = ri.item_name and rn.subcenter_name = ri.subcenter_name and rn.center_name = ri.center_name;

-- 5) Item extra, fora do documento: o ovo já cadastrado de verdade como
-- item de estoque (com ficha técnica real ligada ao prato "Americano")
-- continua representando estoque, ligado ao subcentro "Alimentos" de
-- Bar de piscina a 100% — decisão confirmada com o proprietário (manter
-- como já está hoje, sem o "(E)" do documento, que trata do gasto de
-- ovos de cozinha sem controle fino, afetar esse item específico).
do $$
declare v_inv_id uuid; v_item_id uuid; v_sub_id uuid;
begin
  select id into v_inv_id from inventory_items where name = 'OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA';
  select subcenter_id into v_sub_id from subcenter_map where subcenter_name = 'Alimentos' and center_name = 'Bar de piscina';
  if v_inv_id is not null and v_sub_id is not null then
    insert into cost_items (name, is_inventory, inventory_item_id)
    values ('OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA', true, v_inv_id)
    returning id into v_item_id;
    insert into cost_item_subcenters (cost_item_id, subcenter_id, alloc_pct) values (v_item_id, v_sub_id, 100);
  end if;
end $$;

-- 6) Backfill dos dados reais já lançados antes desta parte (ver
-- PRD_compras.md seção 21): 4 linhas de "polpa de fruta" (sem item nem
-- categoria) → item de custo "frutas"; 2 linhas de ovo (o mesmo produto,
-- uma delas já ligada ao item de estoque, a outra não) → o item de
-- custo do ovo real acima.
update expense_items set cost_item_id = (select id from cost_items where name = 'frutas' limit 1)
where description ilike 'POLPA%' and cost_item_id is null and fixed_asset_id is null;

update expense_items set cost_item_id = (
  select id from cost_items where name = 'OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA' limit 1
)
where description = 'OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA' and cost_item_id is null and fixed_asset_id is null;

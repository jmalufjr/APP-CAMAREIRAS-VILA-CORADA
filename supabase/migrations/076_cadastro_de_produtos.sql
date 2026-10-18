-- Módulo Contábil — correção de aderência ao PRD: Cadastro de produtos
-- (PRD_compras&contabil.md, seção 22.1 item 5.1). Decisões do
-- proprietário (16/10/2026): tela única que edita, juntos, o item de
-- custo e o item de estoque ligado a ele ("produto" = os dois);
-- "Plano de itens de custo" fica pros gastos que não são produtos
-- (salário, luz, honorários) e mostra os produtos só pra consulta.
--
-- Esta migration cobre os campos do produto. Unidades/conversões
-- (077) e validade por lote (078) vêm em migrations próprias.

-- Tipo de produto (lista fechada do PRD). null = "não classificado" —
-- os itens que já existem começam assim até o admin classificar.
create type product_type as enum (
  'revenda',
  'ingrediente_receita',
  'material_consumo',
  'material_limpeza',
  'embalagem',
  'outro'
);

-- Categorias de produto: lista própria, editável pelo admin. Começa com
-- os nomes dos antigos subcentros do Plano de Contas (migration 065),
-- que o próprio proprietário já tinha curado — nada de começar do zero.
create table product_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index product_categories_name_uq on product_categories (lower(name));

alter table product_categories enable row level security;
create policy "product_categories_select_authenticated" on product_categories for select using (auth.uid() is not null);
create policy "product_categories_admin_write" on product_categories for all using (is_admin()) with check (is_admin());

-- Um produto É um item de custo (sempre) mais, quando controla estoque,
-- o item de estoque ligado a ele. Os campos descritivos moram no item de
-- custo — assim produtos que NÃO controlam estoque (ex.: taças,
-- ferramentas) também têm SKU/descrição/categoria/tipo.
alter table cost_items
  add column is_product boolean not null default false,
  add column sku text,
  add column description text,
  add column category_id uuid references product_categories(id) on delete set null,
  add column product_type product_type;

-- Todo item que controla estoque já é, de fato, um produto. Os demais
-- (despesas e serviços) continuam fora do cadastro até o admin promovê-los.
update cost_items set is_product = true where is_inventory;

-- SKU único (ignorando maiúscula/minúscula) quando preenchido.
create unique index cost_items_sku_uq on cost_items (lower(sku)) where sku is not null;

-- Invariante garantida no banco, não em cada tela: item que controla
-- estoque é sempre produto (mesmo padrão de gatilho usado no resto do
-- schema — nenhum ponto de criação, incluindo "criar item novo" dentro
-- de "Lançar compras e despesas", pode esquecer disso).
create or replace function cost_items_set_product_flag() returns trigger as $$
begin
  if new.is_inventory then
    new.is_product := true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger cost_items_product_flag
before insert or update on cost_items
for each row execute function cost_items_set_product_flag();

-- Categorias iniciais (nomes dos antigos subcentros que classificavam
-- itens de estoque).
insert into product_categories (name, position) values
  ('Alimentos', 1),
  ('Bebidas', 2),
  ('Materiais de limpeza', 3),
  ('Materiais das suítes', 4),
  ('Enxoval de cama e banho', 5),
  ('Materiais de Piscina', 6),
  ('Materiais de Manutenção', 7);

-- Categoria de cada item de estoque já existente, a partir do antigo
-- subcentro dele na migration 065 (item em mais de 1 subcentro: vale o
-- primeiro). Casa por nome; item cujo nome o admin mudou depois, ou
-- criado depois do seed, fica sem categoria até ser classificado na tela.
with seed(item_name, category_name) as (
  values
  ('amenities', 'Materiais das suítes'),
  ('travesseiros', 'Materiais das suítes'),
  ('papel higiênico', 'Materiais das suítes'),
  ('sacos de lixo', 'Materiais das suítes'),
  ('secador de cabelo', 'Materiais das suítes'),
  ('toalhas de banho', 'Enxoval de cama e banho'),
  ('toalhas de rosto', 'Enxoval de cama e banho'),
  ('lençóis', 'Enxoval de cama e banho'),
  ('fronhas', 'Enxoval de cama e banho'),
  ('capas protetoras de travesseiro', 'Enxoval de cama e banho'),
  ('capas protetoras de colchão', 'Enxoval de cama e banho'),
  ('outros materiais de piscina', 'Materiais de Piscina'),
  ('cloro', 'Materiais de Piscina'),
  ('clarificante', 'Materiais de Piscina'),
  ('barrilha', 'Materiais de Piscina'),
  ('pastilhas de cloro', 'Materiais de Piscina'),
  ('fluidos de medidores', 'Materiais de Piscina'),
  ('toalhas de piscina', 'Materiais de Piscina'),
  ('lâmpadas', 'Materiais de Manutenção'),
  ('fita isolante', 'Materiais de Manutenção'),
  ('fita veda rosca', 'Materiais de Manutenção'),
  ('cola de cano', 'Materiais de Manutenção'),
  ('silicone', 'Materiais de Manutenção'),
  ('lubrificantes', 'Materiais de Manutenção'),
  ('antioxidantes', 'Materiais de Manutenção'),
  ('peças de reposição', 'Materiais de Manutenção'),
  ('tomadas', 'Materiais de Manutenção'),
  ('interruptores', 'Materiais de Manutenção'),
  ('outros materiais elétricos', 'Materiais de Manutenção'),
  ('outros materiais hidráulicos', 'Materiais de Manutenção'),
  ('tintas de parede', 'Materiais de Manutenção'),
  ('carrinho de mão', 'Materiais de Manutenção'),
  ('detergente', 'Materiais de limpeza'),
  ('álcool', 'Materiais de limpeza'),
  ('água sanitária', 'Materiais de limpeza'),
  ('desinfetante', 'Materiais de limpeza'),
  ('veja multiuso', 'Materiais de limpeza'),
  ('limpa vidros', 'Materiais de limpeza'),
  ('baldes', 'Materiais de limpeza'),
  ('vassouras', 'Materiais de limpeza'),
  ('rodos', 'Materiais de limpeza'),
  ('sabão líquido', 'Materiais de limpeza'),
  ('sabão em pó', 'Materiais de limpeza'),
  ('sabão em barra', 'Materiais de limpeza'),
  ('café', 'Alimentos'),
  ('chocolate', 'Alimentos'),
  ('farinha de trigo', 'Alimentos'),
  ('manteiga', 'Alimentos'),
  ('margarina', 'Alimentos'),
  ('requeijão', 'Alimentos'),
  ('cream cheese', 'Alimentos'),
  ('croissants', 'Alimentos'),
  ('pães', 'Alimentos'),
  ('açúcar', 'Alimentos'),
  ('sal', 'Alimentos'),
  ('adoçante', 'Alimentos'),
  ('mel', 'Alimentos'),
  ('linguiças', 'Alimentos'),
  ('bacon', 'Alimentos'),
  ('queijos', 'Alimentos'),
  ('presuntos', 'Alimentos'),
  ('farinha de tapioca', 'Alimentos'),
  ('farinha de cuscuz', 'Alimentos'),
  ('carnes', 'Alimentos'),
  ('camarões', 'Alimentos'),
  ('macaxeira', 'Alimentos'),
  ('batatas fritas', 'Alimentos'),
  ('massa de pastel', 'Alimentos'),
  ('bolinhos de bacalhau', 'Alimentos'),
  ('Vodka Smirnoff', 'Bebidas'),
  ('Vodka Absolut', 'Bebidas'),
  ('Cachaça', 'Bebidas'),
  ('Campari', 'Bebidas'),
  ('Gim Tanqueray', 'Bebidas'),
  ('Água de Coco', 'Bebidas'),
  ('Água com gás', 'Bebidas'),
  ('Água sem gás', 'Bebidas'),
  ('Refrigerante', 'Bebidas'),
  ('Cerveja', 'Bebidas'),
  ('Café expresso', 'Bebidas')
)
update cost_items ci
set category_id = pc.id
from seed s
join product_categories pc on lower(pc.name) = lower(s.category_name)
where lower(ci.name) = lower(s.item_name)
  and ci.is_product;

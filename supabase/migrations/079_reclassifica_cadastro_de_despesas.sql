begin;
-- 079: reclassifica o antigo "Cadastro de despesas" (que na prática tinha produtos
-- e ferramentas) e liga TODO produto/despesa a uma conta do plano de contas.

-- Categorias novas
insert into product_categories (name, position)
select v.name, (select coalesce(max(position), 0) from product_categories) + v.ord
from (values ('Utensílios e descartáveis', 1), ('Jardinagem', 2)) as v(name, ord)
where not exists (select 1 from product_categories pc where pc.name = v.name);

-- Categoria de ativo permanente para ferramentas
insert into asset_categories (name)
select 'Ferramentas e utensílios duráveis'
where not exists (select 1 from asset_categories where name = 'Ferramentas e utensílios duráveis');

-- 1) Conta do plano de contas dos produtos que já existiam, pela categoria
update cost_items ci set ledger_account_code = case pc.name
    when 'Alimentos' then 'estoque-alimentos'
    when 'Bebidas' then 'estoque-bebidas'
    when 'Enxoval de cama e banho' then 'estoque-limpeza'
    when 'Materiais das suítes' then 'estoque-limpeza'
    when 'Materiais de limpeza' then 'estoque-limpeza'
    else 'estoque-outros' end
from product_categories pc
where ci.category_id = pc.id and ci.is_product and ci.ledger_account_code is null;
update cost_items set ledger_account_code = 'estoque-alimentos'
where is_product and ledger_account_code is null and name ilike 'ovo %';
update cost_items set ledger_account_code = 'estoque-outros' where is_product and ledger_account_code is null;

-- 2) Despesas de verdade: só ligam à conta
update cost_items ci set ledger_account_code = m.code
from (values ('água', 'agua-esgoto'), ('luz', 'energia-eletrica'), ('gás', 'gas'), ('internet', 'internet-telefonia'), ('dedetização', 'limpeza-areas-comuns'), ('limpeza coqueiros', 'jardinagem'), ('encargos', 'mao-de-obra-operacional'), ('plano de saúde', 'mao-de-obra-operacional'), ('cesta básica', 'mao-de-obra-operacional'), ('salário das camareiras', 'mao-de-obra-operacional'), ('salário dos funcionários de manutenção', 'mao-de-obra-operacional'), ('transporte', 'outras-despesas'), ('impostos e taxas', 'outras-despesas'), ('Contabilidade (Simone Perla)', 'contabilidade-servicos'), ('Financeiro (Márcia)', 'pessoal-administrativo'), ('Invictos (Comercial e Atendimento)', 'contabilidade-servicos'), ('Stays (CMS)', 'contabilidade-servicos'), ('outras honorários administrativos', 'contabilidade-servicos'), ('pró-labore', 'pessoal-administrativo')) as m(name, code)
where ci.name = m.name and not ci.is_product;

-- 3) Materiais, alimentos e descartáveis -> viram produtos (estoque centralizado)
do $$
declare
  r record;
  v_inv uuid;
  v_cat uuid;
begin
  for r in
    select * from (values ('bolos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('brioches', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('frutas', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('legumes', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('verduras', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('ovos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('pimenta', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('salgadinhos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('temperos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('canudos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('mexedores de drink', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('palitos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('guardanapos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('papéis toalha', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('copos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('pratos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('pires', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('talheres', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('taças', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('xícaras', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('jogos americanos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('panos de prato', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('utensílios de cozinha', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('borrifadores', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('buchas', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('estopas', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('panos de limpeza', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('outros materiais de limpeza', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('perfume de ambiente', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('escovão', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('areia', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('argamassa', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('cabos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('caibros', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('canos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('cimento', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('colas em geral', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conduites', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conectores de mangueiras', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conectores em geral', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conexões hidráulicas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('eletrodutos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('fio elétrico', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('impermeabilizantes', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('linhas de madeira', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('lixas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('parafusos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('porcas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('prendedores de toldo', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('rejunte', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('ripas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('tábuas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('telhas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('toras de eucalipto', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('outros materiais de manutenção', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('mangueiras', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('aspersores', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('filtros', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('torneiras de jardim', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('adubo', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('plantas', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('remédios de plantas', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('outros materiais de jardinagem', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('outros materiais de irrigação', 'Jardinagem', 'material_consumo', 'estoque-outros')) as m(name, category, ptype, account)
  loop
    if exists (select 1 from cost_items where name = r.name and not is_product) then
      select id into v_cat from product_categories where name = r.category;
      -- categorias antigas ('Materiais de Manutenção') já existem; as demais acabaram de ser criadas acima
      insert into inventory_items (name, unit) values (r.name, 'un') returning id into v_inv;
      update cost_items
      set is_product = true, is_inventory = true, inventory_item_id = v_inv,
          category_id = v_cat, product_type = r.ptype::product_type, ledger_account_code = r.account
      where name = r.name and not is_product;
    end if;
  end loop;
end $$;

-- 4) Ferramentas e equipamentos -> catálogo do ativo permanente
do $$
declare
  r record;
  v_cat uuid;
  v_id uuid;
begin
  select id into v_cat from asset_categories where name = 'Ferramentas e utensílios duráveis';
  for r in select unnest(array['alicates', 'chaves allen', 'chaves de cano', 'chaves de fenda', 'chaves estrela', 'chaves inglesas', 'martelos', 'trenas', 'serrinha', 'escada', 'medidores em geral', 'outras ferramentas de manutenção']) as name loop
    select id into v_id from cost_items where name = r.name and not is_product;
    if v_id is not null then
      insert into fixed_asset_catalog_items (name, category_id)
      select r.name, v_cat
      where not exists (select 1 from fixed_asset_catalog_items where name = r.name and category_id = v_cat);
      if exists (select 1 from expense_items where cost_item_id = v_id) then
        update cost_items set active = false where id = v_id;
      else
        delete from cost_items where id = v_id;
      end if;
    end if;
  end loop;
end $$;

commit;

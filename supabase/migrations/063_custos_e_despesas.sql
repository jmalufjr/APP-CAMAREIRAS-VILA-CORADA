-- Módulo "Custos e Despesas" — ver PRD_compras.md seção 20 pro raciocínio
-- completo (pesquisa do setor hoteleiro, decisões confirmadas com o
-- proprietário).
--
-- Cada categoria de despesa passa a ter uma "natureza" (direta/fixa/não é
-- custo) e, quando fixa, 4 percentuais de rateio entre os centros de
-- custo (Hospedagem / Café da Manhã / Serviço de Bar / Frigobar — este
-- último só é diferente de zero pra "Luz") — tudo editável pelo admin,
-- nunca fixado no código, pra que o Demonstrativo/Custos se atualizem
-- sozinhos ao editar uma categoria.

create type cost_nature as enum ('custo_direto', 'custo_fixo', 'nao_custo');

alter table expense_categories
  add column cost_nature cost_nature not null default 'custo_fixo',
  add column alloc_hospedagem_pct int not null default 100 check (alloc_hospedagem_pct between 0 and 100),
  add column alloc_cafe_manha_pct int not null default 0 check (alloc_cafe_manha_pct between 0 and 100),
  add column alloc_bar_pct int not null default 0 check (alloc_bar_pct between 0 and 100),
  add column alloc_frigobar_pct int not null default 0 check (alloc_frigobar_pct between 0 and 100),
  add constraint exp_cat_alloc_sums_100 check (
    cost_nature <> 'custo_fixo' or (alloc_hospedagem_pct + alloc_cafe_manha_pct + alloc_bar_pct + alloc_frigobar_pct) = 100
  );

-- Categorias de custo DIRETO (já têm sua própria regra de cálculo —
-- ficha técnica ou rateio por hóspede — não usam os percentuais acima).
update expense_categories set cost_nature = 'custo_direto'
where name in ('Café da manhã', 'Bar da piscina', 'Frigobar');

-- Ativo permanente nunca é custo do período.
update expense_categories set cost_nature = 'nao_custo'
where name = 'Ativos permanentes';

-- "Consumo (luz/água/internet)" virava 1 categoria só — vira 4, cada uma
-- com seu próprio rateio (água/gás/luz têm perfis de uso bem diferentes
-- entre hospedagem, cozinha do café da manhã e bar). Reaproveita a linha
-- existente como "Água" (preserva qualquer item/despesa já vinculada a
-- ela) e cria as outras 3 novas.
update expense_categories
set name = 'Água', cost_nature = 'custo_fixo',
    alloc_hospedagem_pct = 40, alloc_cafe_manha_pct = 30, alloc_bar_pct = 30, alloc_frigobar_pct = 0
where name = 'Consumo (luz/água/internet)';

insert into expense_categories (name, is_inventory_category, cost_nature, alloc_hospedagem_pct, alloc_cafe_manha_pct, alloc_bar_pct, alloc_frigobar_pct)
values
  ('Luz', false, 'custo_fixo', 80, 10, 5, 5),
  ('Gás', false, 'custo_fixo', 0, 50, 50, 0),
  ('Internet', false, 'custo_fixo', 80, 10, 10, 0);

-- Demais categorias fixas: percentuais confirmados com o proprietário
-- (ver PRD_compras.md seção 20).
update expense_categories set alloc_hospedagem_pct = 100, alloc_cafe_manha_pct = 0, alloc_bar_pct = 0, alloc_frigobar_pct = 0
where name in ('Piscina', 'Jardim');

update expense_categories set alloc_hospedagem_pct = 50, alloc_cafe_manha_pct = 30, alloc_bar_pct = 20, alloc_frigobar_pct = 0
where name = 'Pessoal (salários/encargos)';

update expense_categories set alloc_hospedagem_pct = 70, alloc_cafe_manha_pct = 15, alloc_bar_pct = 15, alloc_frigobar_pct = 0
where name in ('Limpeza', 'Enxoval (cama/banho/mesa)', 'Manutenção (elétrica/hidráulica/outros)', 'Serviços profissionais', 'Impostos e taxas', 'Outras');

-- Cada linha de despesa ganha sua própria categoria, usada só quando NÃO
-- há item de estoque vinculado (salário, honorários, conta de serviço
-- avulsa) — quando há item vinculado, a categoria continua vindo das
-- categorias do item (inventory_item_categories), sem mudança.
alter table expense_items add column category_id uuid references expense_categories(id) on delete set null;

-- Agrupamento de itens pro relatório de custo do café da manhã (ex.:
-- "Frutas e ovos" somados como 1 item só, por não termos controle fino
-- de estoque sobre eles) — null = o item aparece com o próprio nome.
alter table inventory_items add column cost_report_group text;

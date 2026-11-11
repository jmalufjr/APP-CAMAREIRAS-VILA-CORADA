-- Categorias que aceitam "ingrediente de produto do bar": alimentos, demais bebidas e
-- bebidas quentes (destilados e vinhos, 100% bar, tambem usados em drinks).
alter table expense_categories add column if not exists allows_ingredient boolean not null default false;
update expense_categories set allows_ingredient = true
where rule in ('alimentos','bebidas') or lower(name) = 'bebidas quentes';

-- Como o gasto de um ingrediente de alimento se divide:
--  bar_cafe      = percentual do bar, resto cafe da manha (padrao)
--  bar_frigobar  = bar x frigobar pelas vendas do mes (ex.: cafe expresso)
alter table ingredients add column if not exists split_mode text not null default 'bar_cafe'
  check (split_mode in ('bar_cafe','bar_frigobar'));

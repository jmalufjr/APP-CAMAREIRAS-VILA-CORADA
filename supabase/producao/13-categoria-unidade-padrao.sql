-- Unidade padrao por categoria de produto: produto novo cadastrado automaticamente (ex.: compra na
-- feira) nasce com a unidade da categoria em que a IA o alocou. Padrao 'un'; Alimentos em kg.
alter table product_categories add column if not exists default_unit text not null default 'un';
update product_categories set default_unit = 'kg' where lower(name) = 'alimentos' and default_unit = 'un';

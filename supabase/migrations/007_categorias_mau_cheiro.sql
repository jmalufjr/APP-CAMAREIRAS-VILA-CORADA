-- ============================================================================
-- Migração: novas categorias de ocorrência manutenção (execute em um único Run)
-- ============================================================================

insert into occurrence_categories (name, position)
select 'Mau cheiro quarto', coalesce(max(position), 0) + 1 from occurrence_categories
union all
select 'Mau cheiro banheiro', coalesce(max(position), 0) + 2 from occurrence_categories;

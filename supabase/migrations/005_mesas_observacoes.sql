-- ============================================================================
-- Migração: campo de observações por mesa do café (execute em um único Run)
-- ============================================================================

alter table daily_breakfast add column notes text;

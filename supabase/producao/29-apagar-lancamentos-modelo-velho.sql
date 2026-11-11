-- ATENCAO: apaga TODOS os lancamentos de compras e despesas do modelo velho,
-- com seus lancamentos contabeis e movimentos de estoque. NAO tem volta.
-- Rodar SOMENTE depois de: (1) copia de seguranca do banco, (2) os SQLs
-- 25, 26, 27 e 28 ja rodados, (3) o sistema novo funcionando.
-- Preserva: fornecedores, cadastros, ativo permanente, estoque cadastrado,
-- contas de bar/frigobar, comandas e tudo do operacional.

begin;

delete from ledger_entries;      -- as linhas (ledger_entry_lines) saem junto
delete from expenses;            -- os itens (expense_items) saem junto
delete from inventory_movements;

select
  (select count(*) from ledger_entries) as lancamentos_contabeis,
  (select count(*) from expenses) as despesas,
  (select count(*) from inventory_movements) as movimentos_estoque;

commit;

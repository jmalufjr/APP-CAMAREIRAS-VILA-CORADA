-- Relatorio de compras: o gerente operacional tambem corrige compras (editar/excluir linhas).
drop policy if exists "expenses_admin_update" on expenses;
create policy "expenses_admin_update" on expenses for update using (is_admin_or_gerente());
drop policy if exists "expenses_admin_delete" on expenses;
create policy "expenses_admin_delete" on expenses for delete using (is_admin_or_gerente());
drop policy if exists "exp_items_admin_delete" on expense_items;
create policy "exp_items_admin_delete" on expense_items for delete using (is_admin_or_gerente());

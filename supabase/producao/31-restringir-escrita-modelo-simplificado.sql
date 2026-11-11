-- Revisao de seguranca do modelo simplificado: o gerente operacional pode LER os
-- cadastros e LANCAR compras, mas so o admin altera cadastros, parametros,
-- aprova/cancela compras pendentes e edita compras ja lancadas.

-- Cadastros e parametros: leitura admin/gerente, escrita so admin.
do $$
declare t text;
begin
  foreach t in array array['result_centers','expense_categories','expense_category_centers','ingredients',
    'expense_settings','recurring_expenses','bar_product_ingredients'] loop
    execute format('drop policy if exists %I on %I', t || '_rw', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for select using (is_admin_or_gerente())', t || '_select', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Compras: gerente le e INSERE (sempre como "registrada"; o gatilho marca os atrasos),
-- e so apaga a propria compra recem criada (limpeza de uma falha no lancamento).
-- Alterar (inclusive aprovar pendente ou cancelar) e so do admin.
drop policy if exists purchases_rw on purchases;
drop policy if exists purchases_select on purchases;
drop policy if exists purchases_insert on purchases;
drop policy if exists purchases_admin on purchases;
drop policy if exists purchases_gerente_delete_own on purchases;
create policy purchases_select on purchases for select using (is_admin_or_gerente());
create policy purchases_insert on purchases for insert
  with check (is_admin() or (is_admin_or_gerente() and status = 'registrada'
    and created_by = auth.uid() and created_at <= now()));
create policy purchases_admin on purchases for all using (is_admin()) with check (is_admin());
create policy purchases_gerente_delete_own on purchases for delete
  using (is_admin_or_gerente() and created_by = auth.uid()
    and created_at > now() - interval '10 minutes' and created_at <= now());

drop policy if exists purchase_lines_rw on purchase_lines;
drop policy if exists purchase_lines_select on purchase_lines;
drop policy if exists purchase_lines_insert on purchase_lines;
drop policy if exists purchase_lines_admin on purchase_lines;
create policy purchase_lines_select on purchase_lines for select using (is_admin_or_gerente());
create policy purchase_lines_insert on purchase_lines for insert with check (
  is_admin() or (
    is_admin_or_gerente() and exists (
      select 1 from purchases p
      where p.id = purchase_lines.purchase_id
        and p.created_by = auth.uid()
        and p.status = 'registrada'
        and p.created_at > now() - interval '10 minutes'
    )
  )
);
create policy purchase_lines_admin on purchase_lines for all using (is_admin()) with check (is_admin());

-- No máximo 1 sessão de contagem física "em_andamento" por categoria (e
-- no máximo 1 sessão "todos os itens" ao mesmo tempo) — trava no banco,
-- não só na Server Action, mesmo padrão já usado pra "1 conta aberta por
-- quarto" em room_bills. category_id é opcional (null = "todos os
-- itens"), então usa coalesce com um UUID sentinela só pra unificar os
-- dois casos num único índice.
create unique index inventory_count_sessions_one_open_per_category
  on inventory_count_sessions (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'em_andamento';

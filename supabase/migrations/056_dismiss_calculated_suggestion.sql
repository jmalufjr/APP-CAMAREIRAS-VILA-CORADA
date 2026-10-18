-- Permite ao admin dispensar a sugestão CALCULADA pelo sistema (não só o
-- pedido visual da equipe, que já podia ser cancelado desde a migration
-- 055) — pedido que tinha ficado de fora da primeira leva.
--
-- Como a sugestão calculada nunca é um valor persistido (é sempre
-- recalculada na hora a partir do saldo — ver inventory_purchase_suggestions),
-- "dispensar" não pode ser um apagar permanente: guardamos o saldo no
-- momento da dispensa, e ela só vale enquanto o saldo não mudar de novo.
-- Assim que qualquer movimento altera o saldo do item (nova compra, novo
-- consumo), a dispensa fica automaticamente obsoleta e a sugestão volta a
-- aparecer — sem precisar de nenhum job de limpeza, só uma comparação na
-- hora de ler (ver getPurchaseList).
create table inventory_suggestion_dismissals (
  inventory_item_id uuid primary key references inventory_items(id) on delete cascade,
  dismissed_balance numeric(12,3) not null,
  dismissed_by uuid references profiles(id) on delete set null,
  dismissed_at timestamptz not null default now()
);

alter table inventory_suggestion_dismissals enable row level security;
create policy "inv_suggestion_dismissals_admin_all" on inventory_suggestion_dismissals
  for all using (is_admin()) with check (is_admin());

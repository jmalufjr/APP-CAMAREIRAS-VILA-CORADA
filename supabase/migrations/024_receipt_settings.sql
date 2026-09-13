-- E-mail de destino do recibo em PDF (contabilidade) passa a ser configurável
-- pelo admin na própria tela "Consumo por quartos", em vez de fixo por
-- variável de ambiente — mesmo padrão de singleton já usado em
-- commission_settings.
create table receipt_settings (
  id int primary key default 1,
  accounting_email text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into receipt_settings (id, accounting_email) values (1, null);

alter table receipt_settings enable row level security;
create policy "rs_select_authenticated" on receipt_settings for select using (auth.uid() is not null);
create policy "rs_admin_update" on receipt_settings for update using (is_admin());

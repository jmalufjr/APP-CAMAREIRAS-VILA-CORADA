-- Módulo Contábil — Leva 2: fornecedores (cadastro de verdade),
-- contas a pagar (compra/despesa "a prazo"), novos campos na tela de
-- compras (data de competência, número do documento, desconto/frete/
-- tributos por item) e a conta contábil de cada item de custo. Ver
-- PRD_compras&contabil.md seção 22/24.

-- ---------- FORNECEDORES ----------
-- Hoje "fornecedor" é só texto livre em duas colunas independentes
-- (expenses.supplier_name e fixed_assets.supplier_name), que nem batem
-- entre si por causa de maiúscula/minúscula. Esta tabela os unifica.
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cpf_cnpj text,
  email text,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index suppliers_name_uq on suppliers (lower(name));

-- Backfill a partir dos nomes já digitados, juntando nomes iguais
-- (ignorando maiúscula/minúscula) — decisão explícita do proprietário,
-- pra não perder a referência das compras antigas.
insert into suppliers (name)
select distinct on (lower(trim(supplier_name))) trim(supplier_name)
from (
  select supplier_name from expenses where supplier_name is not null and trim(supplier_name) <> ''
  union all
  select supplier_name from fixed_assets where supplier_name is not null and trim(supplier_name) <> ''
) t
order by lower(trim(supplier_name)), trim(supplier_name);

alter table expenses add column supplier_id uuid references suppliers(id) on delete set null;
update expenses e set supplier_id = s.id from suppliers s where lower(trim(e.supplier_name)) = lower(s.name);
alter table expenses drop column supplier_name;

alter table fixed_assets add column supplier_id uuid references suppliers(id) on delete set null;
update fixed_assets fa set supplier_id = s.id from suppliers s where lower(trim(fa.supplier_name)) = lower(s.name);
alter table fixed_assets drop column supplier_name;

alter table suppliers enable row level security;
create policy "suppliers_select_authenticated" on suppliers for select using (auth.uid() is not null);
create policy "suppliers_insert_admin_manutencao" on suppliers for insert with check (is_admin() or is_manutencao());
create policy "suppliers_admin_update" on suppliers for update using (is_admin());
create policy "suppliers_admin_delete" on suppliers for delete using (is_admin());

-- ---------- CONTAS A PAGAR (compra/despesa "a prazo") ----------
-- A despesa em si já carrega o estado "pago"/"pendente" — não existe
-- uma tabela separada de "obrigação": a despesa É a obrigação enquanto
-- pendente. "Pagar" só atualiza esta mesma linha (status/paid_at/forma)
-- e gera o lançamento contábil de liquidação, sem reconhecer a despesa
-- de novo (ver pay_expense em src/lib/actions/expenses.ts).
create type expense_payment_status as enum ('pago', 'pendente');

-- Forma de pagamento do lado FORNECEDOR (a pousada pagando), separada
-- da forma de pagamento do lado HÓSPEDE (já existente, `payment_method`,
-- usada por room_bills) — são conceitos diferentes (ver
-- PRD_compras&contabil.md seção 22.3 item 12).
create type supplier_payment_method as enum ('banco_pix', 'dinheiro', 'cartao_corporativo', 'a_prazo');

alter table expenses
  add column competence_date date,
  add column document_number text,
  add column due_date date,
  add column payment_status expense_payment_status not null default 'pago',
  add column paid_at timestamptz;

-- Toda despesa já lançada antes desta leva é um fato passado, sempre já
-- liquidado — o conceito de "pendente" não existia ainda.
update expenses set competence_date = date, paid_at = created_at, payment_status = 'pago';
alter table expenses alter column competence_date set not null;

-- Troca o tipo da coluna pro novo enum específico de fornecedor,
-- mapeando os valores antigos pro mais próximo equivalente (nenhuma
-- despesa real usava 'boleto' até aqui, confirmado antes de migrar).
alter table expenses add column payment_method_new supplier_payment_method;
update expenses set payment_method_new = case payment_method::text
  when 'pix' then 'banco_pix'
  when 'transferencia_bancaria' then 'banco_pix'
  when 'dinheiro' then 'dinheiro'
  when 'cartao_credito' then 'cartao_corporativo'
  when 'cartao_debito' then 'cartao_corporativo'
  when 'boleto' then 'banco_pix'
  else null
end::supplier_payment_method;
alter table expenses drop column payment_method;
alter table expenses rename column payment_method_new to payment_method;

alter table expense_items
  add column discount numeric(12,2) not null default 0 check (discount >= 0),
  add column freight_and_other_costs numeric(12,2) not null default 0 check (freight_and_other_costs >= 0),
  add column recoverable_tax numeric(12,2) not null default 0 check (recoverable_tax >= 0),
  add column non_recoverable_tax numeric(12,2) not null default 0 check (non_recoverable_tax >= 0);

-- ---------- CONTA CONTÁBIL DE CADA ITEM DE CUSTO ----------
-- Qual conta do plano de contas CONTÁBIL (ledger_accounts) o gasto
-- desse item posta nos lançamentos automáticos — null = usa um padrão
-- genérico (estoque-outros se representa estoque, outras-despesas se
-- não), sempre editável pelo admin em "Plano de itens de custo".
alter table cost_items add column ledger_account_code text references ledger_accounts(code);

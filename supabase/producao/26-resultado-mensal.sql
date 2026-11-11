-- Resultado mensal (PRD_modelo_simplificado.md): receitas datadas.

-- 1) Frigobar: cada lançamento (mudança de quantidade) fica datado.
--    O gatilho vale para qualquer caminho que grave o consumo.
create table if not exists minibar_launches (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references room_bills(id) on delete cascade,
  minibar_item_id uuid not null references minibar_items(id) on delete cascade,
  delta int not null check (delta <> 0),
  unit_price numeric(10,2) not null,
  launched_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default now()
);
create index if not exists minibar_launches_date_idx on minibar_launches (launched_on);
create index if not exists minibar_launches_bill_idx on minibar_launches (bill_id);

create or replace function log_minibar_launch() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d int;
begin
  if tg_op = 'INSERT' then
    d := new.quantity;
  else
    d := new.quantity - old.quantity;
  end if;
  if d <> 0 then
    insert into minibar_launches (bill_id, minibar_item_id, delta, unit_price)
    values (new.bill_id, new.minibar_item_id, d, new.price_snapshot);
  end if;
  return new;
end;
$$;

drop trigger if exists room_bill_minibar_items_launch on room_bill_minibar_items;
create trigger room_bill_minibar_items_launch
  after insert or update of quantity on room_bill_minibar_items
  for each row execute function log_minibar_launch();

-- Saldos já existentes entram com a data de hoje (não há data anterior).
insert into minibar_launches (bill_id, minibar_item_id, delta, unit_price)
select bill_id, minibar_item_id, quantity, price_snapshot
from room_bill_minibar_items
where quantity > 0
  and not exists (select 1 from minibar_launches l where l.bill_id = room_bill_minibar_items.bill_id);

-- 2) Receita de bar/frigobar que chegou depois da janela de 30 dias: o admin decide.
create table if not exists revenue_approvals (
  bill_id uuid not null references room_bills(id) on delete cascade,
  month date not null,
  decision text not null check (decision in ('aprovada','cancelada')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  primary key (bill_id, month)
);

-- 3) Hospedagem (Stays): valores congelados 30 dias após o fim do mês.
create table if not exists lodging_month_freeze (
  month date primary key,
  gross numeric(14,2) not null,
  commission numeric(14,2) not null,
  frozen_at timestamptz not null default now(),
  approved_by uuid references profiles(id) on delete set null
);

alter table minibar_launches enable row level security;
alter table revenue_approvals enable row level security;
alter table lodging_month_freeze enable row level security;

drop policy if exists minibar_launches_select on minibar_launches;
create policy minibar_launches_select on minibar_launches for select using (is_admin_or_gerente());
drop policy if exists revenue_approvals_rw on revenue_approvals;
create policy revenue_approvals_rw on revenue_approvals for all using (is_admin()) with check (is_admin());
drop policy if exists revenue_approvals_select on revenue_approvals;
create policy revenue_approvals_select on revenue_approvals for select using (is_admin_or_gerente());
drop policy if exists lodging_month_freeze_select on lodging_month_freeze;
create policy lodging_month_freeze_select on lodging_month_freeze for select using (is_admin_or_gerente());
drop policy if exists lodging_month_freeze_admin on lodging_month_freeze;
create policy lodging_month_freeze_admin on lodging_month_freeze for all using (is_admin()) with check (is_admin());

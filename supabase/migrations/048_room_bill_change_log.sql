-- Histórico de mudanças versionado (PRD_consumos-api-joao-v1.md, item 4 —
-- endpoint /changes). Implementado via trigger no banco, não em código
-- TypeScript: garante que NENHUM ponto de escrita (Server Action, função
-- SQL security definer, sincronização com a Stays) pode esquecer de
-- registrar uma mudança, porque nenhum deles precisa saber que isso existe.
alter table room_bills add column version int not null default 1;
alter table room_bills add column updated_at timestamptz not null default now();

create table room_bill_change_events (
  id bigserial primary key,
  bill_id uuid not null references room_bills(id) on delete cascade,
  version int not null,
  occurred_at timestamptz not null default now()
);
create index room_bill_change_events_bill_id_idx on room_bill_change_events(bill_id);

alter table room_bill_change_events enable row level security;
-- Só a API externa lê isso (via client admin/service-role, sem RLS);
-- dentro do app, só o admin teria motivo de inspecionar.
create policy room_bill_change_events_admin_select on room_bill_change_events
  for select using (is_admin());

-- Incrementa version/updated_at a cada UPDATE de room_bills — roda ANTES
-- de gravar a linha, então nunca dispara outro UPDATE (sem risco de
-- recursão), diferente de tentar fazer isso num AFTER trigger.
create or replace function bump_room_bill_version() returns trigger as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger room_bills_bump_version
before insert or update on room_bills
for each row execute function bump_room_bill_version();

-- Registra o evento depois que a linha (já com version/updated_at certos)
-- foi de fato gravada.
create or replace function log_room_bill_change_event() returns trigger as $$
begin
  insert into room_bill_change_events (bill_id, version) values (new.id, new.version);
  return new;
end;
$$ language plpgsql;

create trigger room_bills_log_change
after insert or update on room_bills
for each row execute function log_room_bill_change_event();

-- Qualquer mudança nos itens/comandas de uma conta também precisa contar
-- como mudança da conta — dispara o mesmo mecanismo acima com um UPDATE
-- "vazio" na conta pai (o SET não muda valor nenhum por si só; quem
-- incrementa version de verdade é o trigger BEFORE já criado acima).
create or replace function bump_parent_bill_direct() returns trigger as $$
declare
  v_bill_id uuid;
begin
  v_bill_id := coalesce(new.bill_id, old.bill_id);
  update room_bills set version = version where id = v_bill_id;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger room_bill_minibar_items_bump_bill
after insert or update or delete on room_bill_minibar_items
for each row execute function bump_parent_bill_direct();

create trigger bar_comandas_bump_bill
after insert or update or delete on bar_comandas
for each row execute function bump_parent_bill_direct();

-- bar_comanda_items só tem comanda_id — resolve bill_id via bar_comandas
-- antes do mesmo UPDATE "vazio".
create or replace function bump_parent_bill_via_comanda() returns trigger as $$
declare
  v_comanda_id uuid;
  v_bill_id uuid;
begin
  v_comanda_id := coalesce(new.comanda_id, old.comanda_id);
  select bill_id into v_bill_id from bar_comandas where id = v_comanda_id;
  if v_bill_id is not null then
    update room_bills set version = version where id = v_bill_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger bar_comanda_items_bump_bill
after insert or update or delete on bar_comanda_items
for each row execute function bump_parent_bill_via_comanda();

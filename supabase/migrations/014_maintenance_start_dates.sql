-- Permite ao admin definir a data da primeira manutenção de uma categoria
-- de manutenção preventiva (ar condicionados, boiler etc.) e, por item,
-- escolher se ele segue essa mesma data inicial ou tem sua própria data e
-- cronograma independente. O cronograma (next_due_date) é recalculado toda
-- vez que uma dessas datas (ou a periodicidade de um item) muda.
alter table maintenance_categories add column start_date date;
alter table maintenance_items add column follows_category_start_date boolean not null default true;
alter table maintenance_items add column start_date date;

-- Dada uma data de início e uma periodicidade em dias, calcula a próxima
-- data prevista: a própria data de início, se ainda não chegou, ou a
-- primeira ocorrência do ciclo (início + N*periodicidade) a partir de hoje.
create or replace function compute_next_due_date(p_start_date date, p_periodicity_days int)
returns date as $$
  select case
    when p_start_date >= current_date then p_start_date
    else p_start_date + (
      ceil((current_date - p_start_date)::numeric / p_periodicity_days) * p_periodicity_days
    )::int
  end;
$$ language sql stable;

-- Recalcula next_due_date de todos os itens da categoria que seguem a data
-- inicial dela (chamada sempre que o admin define/altera essa data).
create or replace function recompute_category_schedule(p_category_id uuid)
returns void as $$
declare
  v_start_date date;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select start_date into v_start_date from maintenance_categories where id = p_category_id;
  if v_start_date is null then
    return;
  end if;

  update maintenance_items
  set next_due_date = compute_next_due_date(v_start_date, periodicity_days)
  where category_id = p_category_id and follows_category_start_date = true;
end;
$$ language plpgsql security definer;

-- Recalcula next_due_date de um único item, a partir da data inicial da
-- categoria (se ele a segue) ou da sua própria data inicial (se não segue).
create or replace function recompute_item_schedule(p_item_id uuid)
returns void as $$
declare
  v_follows boolean;
  v_own_start date;
  v_cat_start date;
  v_periodicity int;
  v_anchor date;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select mi.follows_category_start_date, mi.start_date, mi.periodicity_days, mc.start_date
    into v_follows, v_own_start, v_periodicity, v_cat_start
  from maintenance_items mi
  join maintenance_categories mc on mc.id = mi.category_id
  where mi.id = p_item_id;

  v_anchor := case when v_follows then v_cat_start else v_own_start end;
  if v_anchor is null then
    return;
  end if;

  update maintenance_items set next_due_date = compute_next_due_date(v_anchor, v_periodicity) where id = p_item_id;
end;
$$ language plpgsql security definer;

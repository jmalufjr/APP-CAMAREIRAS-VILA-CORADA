-- Hospede nao quis o servico (arrumacao/troca) e troca de roupa de cama/banho feita a pedido na arrumacao.
alter table daily_room_tasks
  add column if not exists guest_declined boolean not null default false,
  add column if not exists bedlinen_changed boolean not null default false;

-- A camareira dona do servico informa que o hospede nao quis (so arrumacao ou troca). Vira "cancelado".
create or replace function decline_service_by_guest(p_task_id uuid) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from daily_room_tasks
    where id = p_task_id and assigned_to = auth.uid()
      and status in ('pendente', 'em_andamento')
      and task_type in ('arrumacao', 'troca')
  ) then
    raise exception 'not authorized';
  end if;

  update daily_room_tasks
  set status = 'cancelado', guest_declined = true, cancelled_by = auth.uid(), cancelled_at = now()
  where id = p_task_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Na arrumacao: marca/desmarca "houve troca de roupa de cama e banho a pedido do hospede".
create or replace function set_task_bedlinen_changed(p_task_id uuid, p_value boolean) returns void as $$
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from daily_room_tasks
    where id = p_task_id and assigned_to = auth.uid()
      and status in ('pendente', 'em_andamento')
      and task_type = 'arrumacao'
  ) then
    raise exception 'not authorized';
  end if;

  update daily_room_tasks set bedlinen_changed = p_value where id = p_task_id;
end;
$$ language plpgsql security definer set search_path = public;

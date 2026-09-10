-- Permite ao admin reordenar itens de checklist (arrumação/troca/preparação
-- chegada) e itens de manutenção preventiva, incluindo inserir um item novo
-- em qualquer posição (primeiro, último ou intermediária). Recebe a lista
-- completa de ids já na ordem final desejada (escopada por type/category_id)
-- e reescreve a coluna position de todos eles em 1 round trip.
create or replace function reorder_checklist_items(p_type checklist_type, p_ordered_ids uuid[])
returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  update checklist_items ci
  set position = x.idx
  from unnest(p_ordered_ids) with ordinality as x(id, idx)
  where ci.id = x.id and ci.type = p_type;
end;
$$ language plpgsql security definer;

create or replace function reorder_maintenance_items(p_category_id uuid, p_ordered_ids uuid[])
returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  update maintenance_items mi
  set position = x.idx
  from unnest(p_ordered_ids) with ordinality as x(id, idx)
  where mi.id = x.id and mi.category_id = p_category_id;
end;
$$ language plpgsql security definer;

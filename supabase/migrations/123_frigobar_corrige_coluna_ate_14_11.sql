-- Corrige a conversao do frigobar (122): consumo lancado DEPOIS de 14/11 nao pode ficar na coluna "Ate 14/11".
-- So contas nao pagas. Pre-requisito: 122.
-- Para cada conta e item, o que esta em 'prior' e redistribuido assim:
--   1) servicos finalizados depois de 14/11 (daily_room_task_minibar_items) -> coluna do servico ('s:<servico>');
--   2) lancamentos com data depois de 14/11 que nao sao de servico (minibar_launches.launched_on) -> coluna do dia ('a:<dia>');
--   3) se sobrar e a estadia comecou depois de 14/11, vai para a coluna do dia do check-in;
--   4) o que continuar em 'prior' e so o que e de 14/11 ou antes (ou de conta sem data de check-in).
-- O total de cada item nao muda: so troca a coluna em que a quantidade aparece. Pode rodar mais de uma vez.
do $$
declare
  v_cut date := '2026-11-14';
  b record;
  it record;
  g record;
  v_left int;
  v_take int;
  v_explained int;
  v_leftover int;
begin
  for b in
    select distinct c.bill_id, rb.stay_check_in
    from room_bill_minibar_columns c
    join room_bills rb on rb.id = c.bill_id
    where c.column_key = 'prior' and rb.status <> 'paga'
  loop
    for it in
      select minibar_item_id, quantity from room_bill_minibar_columns
      where bill_id = b.bill_id and column_key = 'prior' and quantity > 0
    loop
      v_left := it.quantity;

      -- 1) servicos
      for g in
        select t.id as task_id, m.quantity as q, m.created_at as at
        from daily_room_task_minibar_items m
        join daily_room_tasks t on t.id = m.task_id
        where m.bill_id = b.bill_id and m.minibar_item_id = it.minibar_item_id and t.date > v_cut
          and not exists (
            select 1 from room_bill_minibar_columns x
            where x.bill_id = b.bill_id and x.minibar_item_id = it.minibar_item_id and x.column_key = 's:' || t.id::text
          )
        order by t.date, m.created_at
      loop
        v_take := least(g.q, v_left);
        exit when v_take <= 0;
        insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity, created_at)
        values (b.bill_id, 's:' || g.task_id::text, it.minibar_item_id, v_take, g.at);
        v_left := v_left - v_take;
      end loop;

      -- 2) lancamentos por dia que nao sao de servico
      for g in
        select launched_on as d, sum(delta) as s, min(created_at) as at
        from minibar_launches
        where bill_id = b.bill_id and minibar_item_id = it.minibar_item_id and source is null and launched_on > v_cut
        group by launched_on
        having sum(delta) > 0
        order by launched_on
      loop
        select coalesce(sum(m.quantity), 0) into v_explained
        from daily_room_task_minibar_items m
        join daily_room_tasks t on t.id = m.task_id
        where m.bill_id = b.bill_id and m.minibar_item_id = it.minibar_item_id and t.date = g.d;
        v_leftover := g.s - v_explained;
        v_take := least(v_leftover, v_left);
        if v_take > 0 and not exists (
          select 1 from room_bill_minibar_columns x
          where x.bill_id = b.bill_id and x.minibar_item_id = it.minibar_item_id and x.column_key = 'a:' || g.d::text
        ) then
          insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity, created_at)
          values (b.bill_id, 'a:' || g.d::text, it.minibar_item_id, v_take, g.at);
          v_left := v_left - v_take;
        end if;
      end loop;

      -- 3) sobra de quem chegou depois de 14/11: vai para o dia do check-in
      if v_left > 0 and b.stay_check_in is not null and b.stay_check_in > v_cut then
        insert into room_bill_minibar_columns (bill_id, column_key, minibar_item_id, quantity)
        values (b.bill_id, 'a:' || b.stay_check_in::text, it.minibar_item_id, v_left)
        on conflict (bill_id, column_key, minibar_item_id)
        do update set quantity = room_bill_minibar_columns.quantity + excluded.quantity, updated_at = now();
        v_left := 0;
      end if;

      if v_left > 0 then
        update room_bill_minibar_columns set quantity = v_left, updated_at = now()
        where bill_id = b.bill_id and column_key = 'prior' and minibar_item_id = it.minibar_item_id;
      else
        delete from room_bill_minibar_columns
        where bill_id = b.bill_id and column_key = 'prior' and minibar_item_id = it.minibar_item_id;
      end if;
    end loop;
  end loop;
end $$;

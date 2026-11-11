-- Corte do modelo antigo (PRD_modelo_simplificado.md): o consumo de bar e
-- frigobar deixa de lancar custo, e a conta da suite deixa de lancar receita
-- no livro de partidas dobradas. O resultado mensal agora e calculado direto
-- das compras, comandas, frigobar (datado) e Stays; o livro antigo fica so
-- como historico. Os dois gatilhos continuam existindo, mas nao fazem mais nada.

create or replace function post_inventory_movement_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Modelo simplificado: sem custo no consumo.
  return new;
end;
$$;

create or replace function post_room_bill_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Modelo simplificado: a receita vem das comandas e do frigobar datados.
  return new;
end;
$$;

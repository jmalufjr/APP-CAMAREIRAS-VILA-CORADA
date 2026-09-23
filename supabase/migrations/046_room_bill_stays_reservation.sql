-- Referência opaca à reserva da Stays que originou o consumo de uma conta
-- (bar/frigobar) — nunca o nome do hóspede, só o _id da reserva. Serve pra
-- a futura API de consumos poder ligar uma conta paga à estadia
-- correspondente, sem precisar de nenhuma entidade "estadia" nova: uma
-- reserva já é identificada de forma única por suíte + período + hóspede.
-- Nullable e sem índice — só é lida, nunca consultada por este app.
alter table room_bills add column stays_reservation_id text;

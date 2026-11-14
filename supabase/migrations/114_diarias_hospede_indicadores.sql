-- Hóspedes-diária vendidos por mês e canal (soma, em cada diária paga, do número de hóspedes da reserva).
-- Usado no "custo de café da manhã por hóspede" do Resultado mensal. Os meses antigos ficam 0 até a
-- próxima sincronização da Stays (que refaz de 3 meses atrás até 6 à frente).
alter table indicator_month_channels add column if not exists paid_guest_nights int not null default 0;

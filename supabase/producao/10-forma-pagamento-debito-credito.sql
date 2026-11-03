-- 089: formas de pagamento da compra: cartão de débito e cartão de crédito.
--  banco_pix / cartao_debito -> pagos pelo banco; dinheiro -> caixa;
--  cartao_credito / a_prazo -> ficam pendentes (contas a pagar).
-- "cartao_corporativo" continua existindo só para as compras antigas.
-- (valores de enum precisam ficar numa execução separada de qualquer uso deles)
alter type supplier_payment_method add value if not exists 'cartao_debito';
alter type supplier_payment_method add value if not exists 'cartao_credito';

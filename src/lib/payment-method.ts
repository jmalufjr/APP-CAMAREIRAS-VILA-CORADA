import type { PaymentMethod, SupplierPaymentMethod } from "@/lib/types";

// Forma de pagamento do HÓSPEDE, pagando a própria conta de consumo
// (room_bills.payment_method) — nunca usada pro lado fornecedor (ver
// SUPPLIER_PAYMENT_METHOD_* abaixo, usado por expenses.payment_method
// desde o Módulo Contábil Leva 2).
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia_bancaria: "Transferência bancária",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
};

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: PAYMENT_METHOD_LABELS.pix },
  { value: "cartao_credito", label: PAYMENT_METHOD_LABELS.cartao_credito },
  { value: "cartao_debito", label: PAYMENT_METHOD_LABELS.cartao_debito },
  { value: "transferencia_bancaria", label: PAYMENT_METHOD_LABELS.transferencia_bancaria },
  { value: "dinheiro", label: PAYMENT_METHOD_LABELS.dinheiro },
  { value: "boleto", label: PAYMENT_METHOD_LABELS.boleto },
];

// Só as 5 formas que fazem sentido pra um hóspede pagar a própria conta
// de consumo — "boleto" nunca aparece nesse seletor (não existe "boleto
// de hóspede").
export const GUEST_PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== "boleto");

// Forma de pagamento do lado FORNECEDOR, usada em "Lançar compras e
// despesas" (expenses.payment_method) — "a_prazo" não é uma forma de
// pagamento de verdade, é a ausência de pagamento por ora: a despesa
// nasce "pendente" e vira uma conta a pagar, até alguém registrar o
// pagamento de verdade na tela "Pagamentos e recebimentos".
export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  banco_pix: "Banco/PIX",
  dinheiro: "Dinheiro",
  cartao_corporativo: "Cartão corporativo",
  a_prazo: "A prazo (fica pendente)",
};

export const SUPPLIER_PAYMENT_METHOD_OPTIONS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: "banco_pix", label: SUPPLIER_PAYMENT_METHOD_LABELS.banco_pix },
  { value: "dinheiro", label: SUPPLIER_PAYMENT_METHOD_LABELS.dinheiro },
  { value: "cartao_corporativo", label: SUPPLIER_PAYMENT_METHOD_LABELS.cartao_corporativo },
  { value: "a_prazo", label: SUPPLIER_PAYMENT_METHOD_LABELS.a_prazo },
];

// Só as 3 formas de liquidação de verdade (sem "a prazo", que não é uma
// forma de pagamento, é a ausência dele) — usado na tela "Pagamentos e
// recebimentos" ao registrar o pagamento de uma conta pendente.
export const SETTLEMENT_PAYMENT_METHOD_OPTIONS = SUPPLIER_PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== "a_prazo");

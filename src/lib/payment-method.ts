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

// Forma de pagamento do lado FORNECEDOR, usada em "Lançar Compra"/"Lançar Despesa"
// (expenses.payment_method). Cartão de crédito e "a prazo" não são pagamentos de
// verdade: a compra nasce "pendente" e vira uma conta a pagar, até alguém registrar o
// pagamento na tela "Pagamentos e recebimentos". PIX e cartão de débito saem do banco;
// dinheiro sai do caixa.
export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  banco_pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_debito: "Cartão de débito",
  cartao_credito: "Cartão de crédito (fica pendente)",
  a_prazo: "A prazo (fica pendente)",
  cartao_corporativo: "Cartão corporativo", // legado
};

export const SUPPLIER_PAYMENT_METHOD_OPTIONS: { value: SupplierPaymentMethod; label: string }[] = [
  "banco_pix",
  "dinheiro",
  "cartao_debito",
  "cartao_credito",
  "a_prazo",
].map((v) => ({ value: v as SupplierPaymentMethod, label: SUPPLIER_PAYMENT_METHOD_LABELS[v as SupplierPaymentMethod] }));

// Formas que NÃO pagam na hora: a compra fica pendente e exige data de vencimento.
export function isPendingPaymentMethod(method: string | null | undefined): boolean {
  return method === "a_prazo" || method === "cartao_credito";
}

// Só as formas de liquidação de verdade (as que não deixam pendente) — usado na tela
// "Pagamentos e recebimentos" ao registrar o pagamento de uma conta pendente.
export const SETTLEMENT_PAYMENT_METHOD_OPTIONS = SUPPLIER_PAYMENT_METHOD_OPTIONS.filter(
  (o) => !isPendingPaymentMethod(o.value)
);

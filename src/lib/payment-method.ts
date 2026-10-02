import type { PaymentMethod } from "@/lib/types";

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

// Só as 5 formas que fazem sentido pra um hóspede pagar a própria conta de
// consumo (room_bills.payment_method) — "boleto" só existe pro módulo de
// compras/despesas (pagamento a fornecedor), nunca aparece nesse seletor.
export const GUEST_PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== "boleto");

import type { ComandaStatus } from "@/lib/types";

// Rótulo exibido para uma comanda: não existe um status "paga" na própria
// comanda (bar_comandas.status só tem original/cancelada/editada) — "Paga"
// é derivado de a conta do quarto associada ter sido paga
// (bill_paid_at presente), usado só na lista de comandas inativas do admin.
export function comandaDisplayStatus(comanda: { status: ComandaStatus; bill_paid_at: string | null }): string {
  if (comanda.status === "cancelada") return "Cancelada";
  if (comanda.bill_paid_at) return "Paga";
  return comanda.status === "editada" ? "Editada" : "Original";
}

import type { MaintenanceExecutionType, MaintenanceItemStatus } from "@/lib/types";

export const EXECUTION_TYPE_LABELS: Record<MaintenanceExecutionType, string> = {
  nao_tecnico: "Não técnico (interno)",
  tecnico: "Técnico (externo)",
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceItemStatus | "concluida", string> = {
  pendente: "Pendente",
  selecionada: "Selecionada",
  concluida: "Concluída",
};

export function periodicityLabel(days: number): string {
  if (days === 7) return "Semanal";
  if (days === 15) return "Quinzenal";
  if (days === 30) return "Mensal";
  if (days === 90) return "Trimestral";
  if (days === 180) return "Semestral";
  if (days === 365) return "Anual";
  if (days % 365 === 0) return `A cada ${days / 365} anos`;
  return `A cada ${days} dias`;
}

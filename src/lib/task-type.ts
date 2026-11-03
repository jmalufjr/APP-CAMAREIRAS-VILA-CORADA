import type { ChecklistType } from "@/lib/types";

export const TASK_TYPE_LABELS: Record<ChecklistType, string> = {
  arrumacao: "Arrumação",
  preparacao: "Saída com Chegada",
  troca: "Troca",
  somente_saida: "Somente Saída",
  somente_chegada: "Somente Chegada",
  limpeza_adicional: "Limpeza adicional",
};

// Nome exibido de uma tarefa: com a Limpeza adicional vira "Troca com Limpeza adicional" etc.
export function taskTypeLabel(type: ChecklistType, extraCleaning?: boolean | null): string {
  const base = TASK_TYPE_LABELS[type];
  return extraCleaning ? `${base} com Limpeza adicional` : base;
}

export const TASK_TYPE_OPTIONS: { value: ChecklistType; label: string }[] = [
  { value: "arrumacao", label: TASK_TYPE_LABELS.arrumacao },
  { value: "preparacao", label: TASK_TYPE_LABELS.preparacao },
  { value: "somente_saida", label: TASK_TYPE_LABELS.somente_saida },
  { value: "somente_chegada", label: TASK_TYPE_LABELS.somente_chegada },
  { value: "troca", label: TASK_TYPE_LABELS.troca },
];

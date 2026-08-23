import type { ChecklistType } from "@/lib/types";

export const TASK_TYPE_LABELS: Record<ChecklistType, string> = {
  arrumacao: "Arrumação",
  preparacao: "Preparação Chegada",
  troca: "Troca",
};

export const TASK_TYPE_OPTIONS: { value: ChecklistType; label: string }[] = [
  { value: "arrumacao", label: TASK_TYPE_LABELS.arrumacao },
  { value: "preparacao", label: TASK_TYPE_LABELS.preparacao },
  { value: "troca", label: TASK_TYPE_LABELS.troca },
];

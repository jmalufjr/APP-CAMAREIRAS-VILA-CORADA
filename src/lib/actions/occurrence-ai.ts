"use server";

import { revalidatePath } from "next/cache";
import { getOccurrenceAssessment } from "@/lib/occurrence-ai";

// Pede uma avaliação nova da IA. É uma ação do servidor (POST, com verificação de origem do Next.js) e a
// leitura respeita um intervalo mínimo entre regerações da mesma ocorrência (ver REGENERATE_COOLDOWN_MS).
export async function regenerateOccurrenceAssessment(occurrenceId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(occurrenceId)) return { error: "Ocorrência inválida." };
  const view = await getOccurrenceAssessment(occurrenceId, true);
  if (!view) return { error: "Ocorrência não encontrada." };
  revalidatePath(`/manutencao/ocorrencias/${occurrenceId}/avaliacao-ia`);
  if (view.error) return { error: view.error };
  return { success: true };
}

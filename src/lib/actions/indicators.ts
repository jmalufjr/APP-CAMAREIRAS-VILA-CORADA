"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/authz";
import { syncStaysIndicators } from "@/lib/actions/stays-sync";
import { loadIndicators, type IndicatorsData } from "@/lib/indicators-load";

export type { IndicatorsData };

// Indicadores mensais, calculados na hora a partir da base guardada (rápido). Na primeira vez (nada
// guardado) faz a importação completa do histórico na Stays. O número de suítes de cada mês vem de
// suitesInMonth (não do banco).
export async function getIndicators(): Promise<{ error: string } | IndicatorsData> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;

  const supabase = await createClient();
  const countRes = await supabase.from("indicator_months").select("month", { count: "exact", head: true });
  if (countRes.error) return { error: countRes.error.message };
  if ((countRes.count ?? 0) === 0) {
    const first = await syncStaysIndicators({ full: true });
    if ("error" in first && first.error) return { error: first.error };
  }

  return loadIndicators(supabase);
}

// Botão "Atualizar histórico completo".
export async function refreshIndicatorsFull() {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  const result = await syncStaysIndicators({ full: true });
  if ("error" in result && result.error) return { error: result.error };
  return { success: true as const };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/date";

// Valor total do pote de comissão do café da manhã (comissão "Suítes e
// Café") num intervalo de datas — mesma regra já usada no Resumo Executivo
// e no Histórico: eligible_suites_count × valor da comissão por café
// servido, somado dia a dia, com fallback pra regra antiga (contagem de
// daily_breakfast_room_assignments × valor atual) em datas sem
// eligible_suites_count. Dias do mês corrente usam o valor ATUAL do campo
// de comissão; dias de meses já fechados usam o commission_value_snapshot
// congelado no dia da sincronização — nunca o valor atual (ver Parte 27).
export async function getBreakfastCommissionPotForRange(from: string, to: string): Promise<number> {
  const supabase = await createClient();
  const currentMonthPrefix = todayKey().slice(0, 7);

  const [{ data: eligibility }, { data: roomAssignments }, { data: commissionSettings }] = await Promise.all([
    supabase
      .from("daily_breakfast_settings")
      .select("date, eligible_suites_count, commission_value_snapshot")
      .gte("date", from)
      .lte("date", to),
    supabase.from("daily_breakfast_room_assignments").select("date, room_id").gte("date", from).lte("date", to),
    supabase.from("commission_settings").select("value_per_table").single(),
  ]);

  const commissionRate = Number(commissionSettings?.value_per_table ?? 0);

  const fallbackSuitesByDate = new Map<string, number>();
  (roomAssignments ?? []).forEach((r) => {
    fallbackSuitesByDate.set(r.date, (fallbackSuitesByDate.get(r.date) ?? 0) + 1);
  });

  const eligibilityByDate = new Map(
    (eligibility ?? []).map((e) => [e.date, e as { date: string; eligible_suites_count: number | null; commission_value_snapshot: number }])
  );
  const allDates = new Set<string>([...eligibilityByDate.keys(), ...fallbackSuitesByDate.keys()]);

  let total = 0;
  allDates.forEach((date) => {
    const e = eligibilityByDate.get(date);
    if (e && e.eligible_suites_count !== null) {
      total +=
        date.slice(0, 7) === currentMonthPrefix
          ? commissionRate * e.eligible_suites_count
          : e.commission_value_snapshot * e.eligible_suites_count;
    } else {
      total += (fallbackSuitesByDate.get(date) ?? 0) * commissionRate;
    }
  });

  return total;
}

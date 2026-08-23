import { createClient } from "@/lib/supabase/server";
import type { Room, DailyArrival, DailyDeparture } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { DateSwitcher } from "@/components/shared/date-switcher";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { ArrivalsDeparturesPanel } from "./arrivals-departures-panel";

export default async function ChegadasSaidasGerenciarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const isToday = sp.date === "hoje";
  const date = isToday ? todayKey() : tomorrowKey();
  const supabase = await createClient();

  const [{ data: rooms }, { data: arrivals }, { data: departures }] = await Promise.all([
    supabase.from("rooms").select("*").eq("active", true).order("position"),
    supabase.from("daily_arrivals").select("*").eq("date", date),
    supabase.from("daily_departures").select("*").eq("date", date),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chegadas & saídas"
        subtitle={`Hóspedes previstos para ${formatDatePt(date)}.`}
        action={<DateSwitcher basePath="/chegadas-saidas/gerenciar" current={isToday ? "hoje" : "amanha"} />}
      />
      <ArrivalsDeparturesPanel
        date={date}
        rooms={(rooms ?? []) as Room[]}
        arrivals={(arrivals ?? []) as DailyArrival[]}
        departures={(departures ?? []) as DailyDeparture[]}
      />
    </div>
  );
}

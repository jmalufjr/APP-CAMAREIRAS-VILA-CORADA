import { createClient } from "@/lib/supabase/server";
import type { Room, Profile, DailyRoomTask } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { PlanningBoard } from "./planning-board";
import { DateSwitcher } from "@/components/shared/date-switcher";
import { SyncStaysButton } from "./sync-stays-button";

export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date === "hoje" ? todayKey() : tomorrowKey();
  const supabase = await createClient();
  const [{ data: rooms }, { data: camareiras }, { data: tasks }] = await Promise.all([
    supabase.from("rooms").select("*").eq("active", true).order("position"),
    supabase.from("profiles").select("*").eq("role", "camareira").eq("active", true).order("name"),
    supabase.from("daily_room_tasks").select("*").eq("date", date),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planejamento diário"
        subtitle={`Defina o tipo de trabalho de cada suíte para ${formatDatePt(date)}. As camareiras escolhem, no próprio app, qual suíte vão realizar.`}
        action={
          <div className="flex items-center gap-2">
            <SyncStaysButton />
            <DateSwitcher basePath="/planejamento" current={sp.date === "hoje" ? "hoje" : "amanha"} />
          </div>
        }
      />
      <PlanningBoard
        date={date}
        rooms={(rooms ?? []) as Room[]}
        camareiras={(camareiras ?? []) as Profile[]}
        tasks={(tasks ?? []) as DailyRoomTask[]}
      />
    </div>
  );
}

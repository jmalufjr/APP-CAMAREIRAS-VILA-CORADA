import { createClient } from "@/lib/supabase/server";
import type { Room, Profile, DailyRoomTask } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { tomorrowKey, formatDatePt } from "@/lib/date";
import { PlanningBoard } from "./planning-board";

export default async function PlanejamentoPage() {
  const date = tomorrowKey();
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
        subtitle={`Defina os quartos de arrumação e preparação para ${formatDatePt(date)}.`}
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

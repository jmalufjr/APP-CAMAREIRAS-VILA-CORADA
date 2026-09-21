import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable, CommissionSettings, DailyBreakfastSettings, Room } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey } from "@/lib/date";
import { GuestsAdminPanel } from "./guests-admin-panel";
import { SyncStaysButton } from "./sync-stays-button";

export default async function GerenciarMesasPage() {
  const supabase = await createClient();
  const [
    { data: tables },
    { data: rooms },
    { data: settings },
    { data: todayRows },
    { data: tomorrowRows },
    { data: todaySettings },
    { data: tomorrowSettings },
    { data: todayAssignments },
    { data: tomorrowAssignments },
  ] = await Promise.all([
    supabase.from("breakfast_tables").select("*").order("created_at", { ascending: true }),
    supabase.from("rooms").select("*").eq("active", true).order("position"),
    supabase.from("commission_settings").select("*").single(),
    supabase.from("daily_breakfast").select("table_id, notes").eq("date", todayKey()),
    supabase.from("daily_breakfast").select("table_id, notes").eq("date", tomorrowKey()),
    supabase.from("daily_breakfast_settings").select("*").eq("date", todayKey()).maybeSingle(),
    supabase.from("daily_breakfast_settings").select("*").eq("date", tomorrowKey()).maybeSingle(),
    supabase.from("daily_breakfast_room_assignments").select("*").eq("date", todayKey()),
    supabase.from("daily_breakfast_room_assignments").select("*").eq("date", tomorrowKey()),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesas do café da manhã"
        subtitle="Edite a quantidade de hóspedes e as observações por mesa."
        action={<SyncStaysButton />}
      />
      <GuestsAdminPanel
        tables={(tables ?? []) as BreakfastTable[]}
        rooms={(rooms ?? []) as Room[]}
        commission={settings as CommissionSettings}
        todayNotes={Object.fromEntries((todayRows ?? []).map((r) => [r.table_id, r.notes ?? ""]))}
        tomorrowNotes={Object.fromEntries((tomorrowRows ?? []).map((r) => [r.table_id, r.notes ?? ""]))}
        todaySettings={todaySettings as DailyBreakfastSettings | null}
        tomorrowSettings={tomorrowSettings as DailyBreakfastSettings | null}
        todayAssignments={todayAssignments ?? []}
        tomorrowAssignments={tomorrowAssignments ?? []}
      />
    </div>
  );
}

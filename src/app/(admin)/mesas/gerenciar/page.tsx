import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable, CommissionSettings } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey } from "@/lib/date";
import { TablesAdminPanel } from "./tables-admin-panel";

export default async function GerenciarMesasPage() {
  const supabase = await createClient();
  const [{ data: tables }, { data: settings }, { data: todayCounts }, { data: tomorrowCounts }] =
    await Promise.all([
      supabase.from("breakfast_tables").select("*").order("created_at", { ascending: true }),
      supabase.from("commission_settings").select("*").single(),
      supabase.from("daily_breakfast").select("table_id, guest_count").eq("date", todayKey()),
      supabase.from("daily_breakfast").select("table_id, guest_count").eq("date", tomorrowKey()),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesas do café da manhã"
        subtitle="Edite o layout, a lista de mesas e a quantidade de hóspedes por mesa."
      />
      <TablesAdminPanel
        tables={(tables ?? []) as BreakfastTable[]}
        commission={settings as CommissionSettings}
        todayCounts={Object.fromEntries((todayCounts ?? []).map((r) => [r.table_id, r.guest_count]))}
        tomorrowCounts={Object.fromEntries((tomorrowCounts ?? []).map((r) => [r.table_id, r.guest_count]))}
      />
    </div>
  );
}

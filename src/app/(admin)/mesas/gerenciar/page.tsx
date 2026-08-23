import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable, CommissionSettings } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey } from "@/lib/date";
import { TablesAdminPanel } from "./tables-admin-panel";

export default async function GerenciarMesasPage() {
  const supabase = await createClient();
  const [{ data: tables }, { data: settings }, { data: todayRows }, { data: tomorrowRows }] =
    await Promise.all([
      supabase.from("breakfast_tables").select("*").order("created_at", { ascending: true }),
      supabase.from("commission_settings").select("*").single(),
      supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", todayKey()),
      supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", tomorrowKey()),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesas do café da manhã"
        subtitle="Edite o layout, a lista de mesas, a quantidade de hóspedes e as observações por mesa."
      />
      <TablesAdminPanel
        tables={(tables ?? []) as BreakfastTable[]}
        commission={settings as CommissionSettings}
        todayCounts={Object.fromEntries((todayRows ?? []).map((r) => [r.table_id, r.guest_count]))}
        tomorrowCounts={Object.fromEntries((tomorrowRows ?? []).map((r) => [r.table_id, r.guest_count]))}
        todayNotes={Object.fromEntries((todayRows ?? []).map((r) => [r.table_id, r.notes ?? ""]))}
        tomorrowNotes={Object.fromEntries((tomorrowRows ?? []).map((r) => [r.table_id, r.notes ?? ""]))}
      />
    </div>
  );
}

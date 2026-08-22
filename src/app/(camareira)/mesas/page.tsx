import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { TableLayoutCanvas } from "@/components/shared/table-layout-canvas";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function MesasViewPage() {
  const supabase = await createClient();
  const [{ data: tables }, { data: todayCounts }, { data: tomorrowCounts }] = await Promise.all([
    supabase.from("breakfast_tables").select("*").eq("active", true).order("created_at"),
    supabase.from("daily_breakfast").select("table_id, guest_count").eq("date", todayKey()),
    supabase.from("daily_breakfast").select("table_id, guest_count").eq("date", tomorrowKey()),
  ]);

  const todayMap = Object.fromEntries((todayCounts ?? []).map((r) => [r.table_id, r.guest_count]));
  const tomorrowMap = Object.fromEntries((tomorrowCounts ?? []).map((r) => [r.table_id, r.guest_count]));

  return (
    <div className="space-y-6">
      <PageHeader title="Mesas do café da manhã" subtitle="Visualização do layout e hóspedes por mesa." />
      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="amanha">Amanhã</TabsTrigger>
        </TabsList>
        <TabsContent value="hoje" className="pt-4 space-y-2">
          <p className="text-sm capitalize text-muted-foreground">{formatDatePt(todayKey())}</p>
          <TableLayoutCanvas tables={(tables ?? []) as BreakfastTable[]} guestCounts={todayMap} />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4 space-y-2">
          <p className="text-sm capitalize text-muted-foreground">{formatDatePt(tomorrowKey())}</p>
          <TableLayoutCanvas tables={(tables ?? []) as BreakfastTable[]} guestCounts={tomorrowMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

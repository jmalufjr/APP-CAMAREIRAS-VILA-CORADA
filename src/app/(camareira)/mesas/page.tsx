import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable, DailyBreakfastSettings } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { TableLayoutCanvas } from "@/components/shared/table-layout-canvas";
import { TableNotesList } from "@/components/shared/table-notes-list";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default async function MesasViewPage() {
  const supabase = await createClient();
  const [
    { data: tables },
    { data: todayRows },
    { data: tomorrowRows },
    { data: todaySettings },
    { data: tomorrowSettings },
  ] = await Promise.all([
    supabase.from("breakfast_tables").select("*").eq("active", true).order("created_at"),
    supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", todayKey()),
    supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", tomorrowKey()),
    supabase.from("daily_breakfast_settings").select("*").eq("date", todayKey()).maybeSingle(),
    supabase.from("daily_breakfast_settings").select("*").eq("date", tomorrowKey()).maybeSingle(),
  ]);

  const tableList = (tables ?? []) as BreakfastTable[];
  const labelById = new Map(tableList.map((t) => [t.id, t.label]));

  const todayMap = Object.fromEntries((todayRows ?? []).map((r) => [r.table_id, r.guest_count]));
  const tomorrowMap = Object.fromEntries((tomorrowRows ?? []).map((r) => [r.table_id, r.guest_count]));
  const todayNotes = (todayRows ?? []).filter((r) => r.notes);
  const tomorrowNotes = (tomorrowRows ?? []).filter((r) => r.notes);

  return (
    <div className="space-y-6">
      <PageHeader title="Mesas do café da manhã" subtitle="Visualização do layout e hóspedes por mesa." />
      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="amanha">Amanhã</TabsTrigger>
        </TabsList>
        <TabsContent value="hoje" className="pt-4 space-y-4">
          <p className="text-sm capitalize text-muted-foreground">{formatDatePt(todayKey())}</p>
          <DaySettingsInfo settings={todaySettings as DailyBreakfastSettings | null} />
          <TableLayoutCanvas tables={tableList} guestCounts={todayMap} />
          <TableNotesList rows={todayNotes} labelById={labelById} />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4 space-y-4">
          <p className="text-sm capitalize text-muted-foreground">{formatDatePt(tomorrowKey())}</p>
          <DaySettingsInfo settings={tomorrowSettings as DailyBreakfastSettings | null} />
          <TableLayoutCanvas tables={tableList} guestCounts={tomorrowMap} />
          <TableNotesList rows={tomorrowNotes} labelById={labelById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DaySettingsInfo({ settings }: { settings: DailyBreakfastSettings | null }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent>
          <p className="text-sm font-medium">Total de mesas do café: {settings?.total_tables ?? 0}</p>
        </CardContent>
      </Card>
      {settings?.notes && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{settings.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

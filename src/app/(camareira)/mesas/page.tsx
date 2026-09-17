import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable, DailyBreakfastSettings, DailyBreakfastRoomAssignment, Room } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { TableLayoutCanvas, type TableRoomAssignment } from "@/components/shared/table-layout-canvas";
import { TableNotesList } from "@/components/shared/table-notes-list";
import { computeTableSizeCounts } from "@/lib/stays/derive-breakfast";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

function toTableRooms(
  assignments: DailyBreakfastRoomAssignment[],
  rooms: Room[]
): Record<string, TableRoomAssignment[]> {
  const numberByRoomId = new Map(rooms.map((r) => [r.id, r.number]));
  const map: Record<string, TableRoomAssignment[]> = {};
  assignments.forEach((a) => {
    const list = map[a.table_id] ?? [];
    list.push({ roomNumber: numberByRoomId.get(a.room_id) ?? "—", guestCount: a.guest_count });
    map[a.table_id] = list;
  });
  return map;
}

export default async function MesasViewPage() {
  const supabase = await createClient();
  const [
    { data: tables },
    { data: rooms },
    { data: todayRows },
    { data: tomorrowRows },
    { data: todaySettings },
    { data: tomorrowSettings },
    { data: todayAssignments },
    { data: tomorrowAssignments },
  ] = await Promise.all([
    supabase.from("breakfast_tables").select("*").eq("active", true).order("created_at"),
    supabase.from("rooms").select("*").eq("active", true).order("position"),
    supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", todayKey()),
    supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", tomorrowKey()),
    supabase.from("daily_breakfast_settings").select("*").eq("date", todayKey()).maybeSingle(),
    supabase.from("daily_breakfast_settings").select("*").eq("date", tomorrowKey()).maybeSingle(),
    supabase.from("daily_breakfast_room_assignments").select("*").eq("date", todayKey()),
    supabase.from("daily_breakfast_room_assignments").select("*").eq("date", tomorrowKey()),
  ]);

  const tableList = (tables ?? []) as BreakfastTable[];
  const roomList = (rooms ?? []) as Room[];
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
          <DaySettingsInfo
            settings={todaySettings as DailyBreakfastSettings | null}
            assignments={(todayAssignments ?? []) as DailyBreakfastRoomAssignment[]}
            tables={tableList}
          />
          <TableLayoutCanvas
            tables={tableList}
            guestCounts={todayMap}
            tableRooms={toTableRooms((todayAssignments ?? []) as DailyBreakfastRoomAssignment[], roomList)}
          />
          <TableNotesList rows={todayNotes} labelById={labelById} />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4 space-y-4">
          <p className="text-sm capitalize text-muted-foreground">{formatDatePt(tomorrowKey())}</p>
          <DaySettingsInfo
            settings={tomorrowSettings as DailyBreakfastSettings | null}
            assignments={(tomorrowAssignments ?? []) as DailyBreakfastRoomAssignment[]}
            tables={tableList}
          />
          <TableLayoutCanvas
            tables={tableList}
            guestCounts={tomorrowMap}
            tableRooms={toTableRooms((tomorrowAssignments ?? []) as DailyBreakfastRoomAssignment[], roomList)}
          />
          <TableNotesList rows={tomorrowNotes} labelById={labelById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DaySettingsInfo({
  settings,
  assignments,
  tables,
}: {
  settings: DailyBreakfastSettings | null;
  assignments: DailyBreakfastRoomAssignment[];
  tables: BreakfastTable[];
}) {
  const counts = computeTableSizeCounts(assignments, tables);
  return (
    <div className="space-y-3">
      <Card>
        <CardContent>
          <p className="text-sm font-medium">Total de mesas do café: {settings?.total_tables ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-1">
          <p className="text-sm">Quantidade de mesas de 1 hóspede: {counts.tables1Guest}</p>
          <p className="text-sm">Quantidade de mesas de 2 hóspedes: {counts.tables2Guest}</p>
          <p className="text-sm">Quantidade de mesas de 3 hóspedes: {counts.tables3Guest}</p>
          <p className="text-sm">Quantidade de hóspedes na Mesa 07: {counts.guestsTable07}</p>
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

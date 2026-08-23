import { createClient } from "@/lib/supabase/server";
import type { BreakfastTable } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { TableLayoutCanvas } from "@/components/shared/table-layout-canvas";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default async function MesasViewPage() {
  const supabase = await createClient();
  const [{ data: tables }, { data: todayRows }, { data: tomorrowRows }] = await Promise.all([
    supabase.from("breakfast_tables").select("*").eq("active", true).order("created_at"),
    supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", todayKey()),
    supabase.from("daily_breakfast").select("table_id, guest_count, notes").eq("date", tomorrowKey()),
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
          <TableLayoutCanvas tables={tableList} guestCounts={todayMap} />
          <NotesList rows={todayNotes} labelById={labelById} />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4 space-y-4">
          <p className="text-sm capitalize text-muted-foreground">{formatDatePt(tomorrowKey())}</p>
          <TableLayoutCanvas tables={tableList} guestCounts={tomorrowMap} />
          <NotesList rows={tomorrowNotes} labelById={labelById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotesList({
  rows,
  labelById,
}: {
  rows: { table_id: string; notes: string | null }[];
  labelById: Map<string, string>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-heading text-base text-primary">Observações</h2>
      {rows.map((r) => (
        <Card key={r.table_id}>
          <CardContent>
            <p className="text-sm font-medium">{labelById.get(r.table_id) ?? "Mesa"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{r.notes}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable, CommissionSettings, DailyBreakfastSettings, DailyBreakfastRoomAssignment, Room } from "@/lib/types";
import { setBreakfastDayNotes, updateCommissionValue } from "@/lib/actions/tables";
import { computeTableSizeCounts } from "@/lib/stays/derive-breakfast";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableLayoutCanvas, type TableRoomAssignment } from "@/components/shared/table-layout-canvas";
import { TableNotesList } from "@/components/shared/table-notes-list";
import { TableAssignmentDialog } from "./table-assignment-dialog";

// Extrai o número da mesa a partir do rótulo (ex.: "Mesa 3" -> 3) para
// ordenar os cards em ordem crescente, independente da ordem de criação.
function tableNumber(label: string): number {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

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

// Mesas com alguma suíte alocada manualmente pelo admin (stays_locked) —
// recebem o destaque amarelo no layout, ver table-layout-canvas.tsx.
function editedTableIds(assignments: DailyBreakfastRoomAssignment[]): Set<string> {
  return new Set(assignments.filter((a) => a.stays_locked).map((a) => a.table_id));
}

export function GuestsAdminPanel({
  tables,
  rooms,
  commission,
  todayCounts,
  tomorrowCounts,
  todayNotes,
  tomorrowNotes,
  todaySettings,
  tomorrowSettings,
  todayAssignments,
  tomorrowAssignments,
}: {
  tables: BreakfastTable[];
  rooms: Room[];
  commission: CommissionSettings;
  todayCounts: Record<string, number>;
  tomorrowCounts: Record<string, number>;
  todayNotes: Record<string, string>;
  tomorrowNotes: Record<string, string>;
  todaySettings: DailyBreakfastSettings | null;
  tomorrowSettings: DailyBreakfastSettings | null;
  todayAssignments: DailyBreakfastRoomAssignment[];
  tomorrowAssignments: DailyBreakfastRoomAssignment[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [commissionValue, setCommissionValue] = useState(String(commission?.value_per_table ?? 10));
  // Mesa clicada no layout "Mesas · hoje/amanhã", pra abrir o diálogo de
  // quais suítes estão alocadas ali — substitui os cards de suítes por mesa
  // que existiam antes.
  const [editingTable, setEditingTable] = useState<{ date: string; table: BreakfastTable } | null>(null);

  const activeTables = tables.filter((t) => t.active);
  const labelById = new Map(tables.map((t) => [t.id, t.label]));
  const notesToRows = (notes: Record<string, string>) =>
    Object.entries(notes)
      .filter(([, v]) => v)
      .map(([table_id, tableNotes]) => ({ table_id, notes: tableNotes }));

  const editingAssignments =
    editingTable?.date === todayKey() ? todayAssignments : editingTable?.date === tomorrowKey() ? tomorrowAssignments : [];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Valor da comissão por café servido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">R$</span>
            <Input
              className="w-32"
              type="number"
              step="0.01"
              min="0"
              value={commissionValue}
              onChange={(e) => setCommissionValue(e.target.value)}
            />
            <Button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await updateCommissionValue(Number(commissionValue));
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Valor atualizado.");
                    router.refresh();
                  }
                })
              }
            >
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Esse valor será multiplicado pelo número de suítes para as quais será servido o café da manhã
            para se obter o valor total da comissão do dia.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Mesas de hoje</TabsTrigger>
          <TabsTrigger value="amanha">Mesas de amanhã</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="pt-4">
          <GuestCountEditor
            date={todayKey()}
            label={formatDatePt(todayKey())}
            tables={tables}
            daySettings={todaySettings}
            assignments={todayAssignments}
          />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4">
          <GuestCountEditor
            date={tomorrowKey()}
            label={formatDatePt(tomorrowKey())}
            tables={tables}
            daySettings={tomorrowSettings}
            assignments={tomorrowAssignments}
          />
        </TabsContent>
      </Tabs>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Mesas · hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Clique numa mesa para escolher quais suítes ficam nela.
            </p>
            <TableLayoutCanvas
              tables={activeTables}
              guestCounts={todayCounts}
              tableRooms={toTableRooms(todayAssignments, rooms)}
              editedTableIds={editedTableIds(todayAssignments)}
              onTableClick={(t) => setEditingTable({ date: todayKey(), table: t })}
            />
            <TableNotesList rows={notesToRows(todayNotes)} labelById={labelById} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Mesas · amanhã</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Clique numa mesa para escolher quais suítes ficam nela.
            </p>
            <TableLayoutCanvas
              tables={activeTables}
              guestCounts={tomorrowCounts}
              tableRooms={toTableRooms(tomorrowAssignments, rooms)}
              editedTableIds={editedTableIds(tomorrowAssignments)}
              onTableClick={(t) => setEditingTable({ date: tomorrowKey(), table: t })}
            />
            <TableNotesList rows={notesToRows(tomorrowNotes)} labelById={labelById} />
          </CardContent>
        </Card>
      </div>

      <TableAssignmentDialog
        date={editingTable?.date ?? todayKey()}
        table={editingTable?.table ?? null}
        rooms={rooms}
        assignments={editingAssignments}
        tableLabelById={labelById}
        notes={editingTable ? (editingTable.date === todayKey() ? todayNotes : tomorrowNotes)[editingTable.table.id] ?? "" : ""}
        onOpenChange={(open) => {
          if (!open) setEditingTable(null);
        }}
      />
    </div>
  );
}

function GuestCountEditor({
  date,
  label,
  tables,
  daySettings,
  assignments,
}: {
  date: string;
  label: string;
  tables: BreakfastTable[];
  daySettings: DailyBreakfastSettings | null;
  assignments: DailyBreakfastRoomAssignment[];
}) {
  const [, startTransition] = useTransition();

  const activeTables = tables.filter((t) => t.active).sort((a, b) => tableNumber(a.label) - tableNumber(b.label));

  const [dayNotes, setDayNotes] = useState(daySettings?.notes ?? "");
  const tableSizeCounts = computeTableSizeCounts(assignments, activeTables);

  function saveDayNotes(nextNotes: string) {
    startTransition(async () => {
      const result = await setBreakfastDayNotes(date, nextNotes);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm capitalize text-muted-foreground">{label}</p>

      <div className="max-w-sm space-y-1.5 text-sm">
        <p className="font-medium">Total de mesas: {tableSizeCounts.totalOccupiedTables}</p>
        <p>Mesas de 1 hóspede: {tableSizeCounts.tables1Guest}</p>
        <p>Mesas de 2 hóspedes: {tableSizeCounts.tables2Guest}</p>
        <p>Mesas de 3 hóspedes: {tableSizeCounts.tables3Guest}</p>
        <p>Hóspedes na Mesa 07: {tableSizeCounts.guestsTable07}</p>
      </div>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor={`obs-dia-${date}`} className="text-sm">
          Observação do dia (visível para as camareiras)
        </Label>
        <Textarea
          id={`obs-dia-${date}`}
          placeholder="Ex.: evento especial, restrição de horário etc."
          className="min-h-16 text-sm"
          value={dayNotes}
          onChange={(e) => setDayNotes(e.target.value)}
          onBlur={() => saveDayNotes(dayNotes)}
        />
      </div>
    </div>
  );
}


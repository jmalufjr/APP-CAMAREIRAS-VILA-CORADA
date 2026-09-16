"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable, CommissionSettings, DailyBreakfastSettings, DailyBreakfastRoomAssignment, Room } from "@/lib/types";
import {
  setGuestCount,
  setTableNotes,
  setBreakfastDaySettings,
  setBreakfastTableCounts,
  setTableRoomAssignment,
  removeTableRoomAssignment,
  updateCommissionValue,
  type BreakfastTableCounts,
} from "@/lib/actions/tables";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableLayoutCanvas, type TableRoomAssignment } from "@/components/shared/table-layout-canvas";
import { TableNotesList } from "@/components/shared/table-notes-list";
import { X, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const activeTables = tables.filter((t) => t.active);
  const labelById = new Map(tables.map((t) => [t.id, t.label]));
  const notesToRows = (notes: Record<string, string>) =>
    Object.entries(notes)
      .filter(([, v]) => v)
      .map(([table_id, tableNotes]) => ({ table_id, notes: tableNotes }));

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Valor da comissão por mesa</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
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
            rooms={rooms}
            counts={todayCounts}
            notesInit={todayNotes}
            daySettings={todaySettings}
            assignments={todayAssignments}
          />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4">
          <GuestCountEditor
            date={tomorrowKey()}
            label={formatDatePt(tomorrowKey())}
            tables={tables}
            rooms={rooms}
            counts={tomorrowCounts}
            notesInit={tomorrowNotes}
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
            <TableLayoutCanvas
              tables={activeTables}
              guestCounts={todayCounts}
              tableRooms={toTableRooms(todayAssignments, rooms)}
            />
            <TableNotesList rows={notesToRows(todayNotes)} labelById={labelById} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Mesas · amanhã</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TableLayoutCanvas
              tables={activeTables}
              guestCounts={tomorrowCounts}
              tableRooms={toTableRooms(tomorrowAssignments, rooms)}
            />
            <TableNotesList rows={notesToRows(tomorrowNotes)} labelById={labelById} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const MAX_GUESTS_PER_TABLE = 10;

function GuestCountEditor({
  date,
  label,
  tables,
  rooms,
  counts,
  notesInit,
  daySettings,
  assignments,
}: {
  date: string;
  label: string;
  tables: BreakfastTable[];
  rooms: Room[];
  counts: Record<string, number>;
  notesInit: Record<string, string>;
  daySettings: DailyBreakfastSettings | null;
  assignments: DailyBreakfastRoomAssignment[];
}) {
  const [values, setValues] = useState(counts);
  const [notes, setNotes] = useState(notesInit);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const total = Object.values(values).reduce((a, b) => a + (b || 0), 0);

  const activeTables = tables.filter((t) => t.active).sort((a, b) => tableNumber(a.label) - tableNumber(b.label));

  const [totalTables, setTotalTables] = useState(String(daySettings?.total_tables ?? 0));
  const [dayNotes, setDayNotes] = useState(daySettings?.notes ?? "");
  const [tableCounts, setTableCounts] = useState<BreakfastTableCounts>({
    tables_1_guest: daySettings?.tables_1_guest ?? 0,
    tables_2_guest: daySettings?.tables_2_guest ?? 0,
    tables_3_guest: daySettings?.tables_3_guest ?? 0,
    guests_table_07: daySettings?.guests_table_07 ?? 0,
  });

  function saveDaySettings(nextTotal: string, nextNotes: string) {
    startTransition(async () => {
      const result = await setBreakfastDaySettings(date, Number(nextTotal), nextNotes);
      if (result?.error) toast.error(result.error);
    });
  }

  function saveTableCounts(next: BreakfastTableCounts) {
    startTransition(async () => {
      const result = await setBreakfastTableCounts(date, next);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm capitalize text-muted-foreground">{label}</p>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor={`total-mesas-${date}`} className="text-sm">
          Total de mesas
        </Label>
        <Select
          value={totalTables}
          onValueChange={(v) => {
            const next = v ?? "0";
            setTotalTables(next);
            saveDaySettings(next, dayNotes);
          }}
          disabled={isPending}
        >
          <SelectTrigger id={`total-mesas-${date}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: activeTables.length + 1 }, (_, n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="max-w-sm space-y-3">
        {(
          [
            ["tables_1_guest", "Quantidade de mesas de 1 hóspede"],
            ["tables_2_guest", "Quantidade de mesas de 2 hóspedes"],
            ["tables_3_guest", "Quantidade de mesas de 3 hóspedes"],
            ["guests_table_07", "Quantidade de hóspedes na Mesa 07"],
          ] as const
        ).map(([field, fieldLabel]) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={`${field}-${date}`} className="text-sm">
              {fieldLabel}
            </Label>
            <Input
              id={`${field}-${date}`}
              type="number"
              min={0}
              className="w-24"
              value={tableCounts[field]}
              onChange={(e) =>
                setTableCounts((c) => ({ ...c, [field]: Math.max(0, Number(e.target.value) || 0) }))
              }
              onBlur={() => saveTableCounts(tableCounts)}
            />
          </div>
        ))}
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
          onBlur={() => saveDaySettings(totalTables, dayNotes)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {activeTables.map((t) => (
          <div key={t.id} className="rounded-lg border border-border p-3 bg-card space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`g-${t.id}`} className="text-sm">{t.label}</Label>
              <Input
                id={`g-${t.id}`}
                type="number"
                min={0}
                max={MAX_GUESTS_PER_TABLE}
                className="w-20"
                value={values[t.id] ?? 0}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [t.id]: Math.min(MAX_GUESTS_PER_TABLE, Number(e.target.value)),
                  }))
                }
                onBlur={() =>
                  startTransition(async () => {
                    await setGuestCount(date, t.id, values[t.id] ?? 0);
                    router.refresh();
                  })
                }
              />
            </div>
            <TableRoomAssignments date={date} tableId={t.id} rooms={rooms} assignments={assignments} />
            <Textarea
              placeholder="Observações desta mesa (visível para as camareiras)"
              className="min-h-14 text-sm"
              value={notes[t.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
              onBlur={() =>
                startTransition(async () => {
                  await setTableNotes(date, t.id, notes[t.id] ?? "");
                  router.refresh();
                })
              }
            />
          </div>
        ))}
      </div>
      <p className="text-sm font-medium">
        Total de mesas ocupadas: {Object.values(values).filter((v) => v > 0).length} · Total de hóspedes: {total}
        {isPending && " · salvando..."}
      </p>
    </div>
  );
}

// Escolhe quais suítes estão sentadas numa mesa, cada uma com sua
// quantidade de hóspedes — a Mesa 7 (maior capacidade) pode receber mais de
// uma suíte (ver PRD_regrasdenegocio.md seção 4). Uma suíte só pode estar
// numa mesa por vez: já alocada em outra mesa neste dia não aparece na
// lista de opções.
function TableRoomAssignments({
  date,
  tableId,
  rooms,
  assignments,
}: {
  date: string;
  tableId: string;
  rooms: Room[];
  assignments: DailyBreakfastRoomAssignment[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newRoomId, setNewRoomId] = useState("");
  const [newGuestCount, setNewGuestCount] = useState("1");

  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const forThisTable = assignments.filter((a) => a.table_id === tableId);
  const assignedElsewhere = new Set(assignments.map((a) => a.room_id));
  const availableRooms = rooms.filter((r) => !assignedElsewhere.has(r.id));

  function handleAdd() {
    if (!newRoomId) return;
    startTransition(async () => {
      const result = await setTableRoomAssignment(date, tableId, newRoomId, Number(newGuestCount) || 0);
      if (result?.error) toast.error(result.error);
      else {
        setNewRoomId("");
        setNewGuestCount("1");
        router.refresh();
      }
    });
  }

  function handleRemove(roomId: string) {
    startTransition(async () => {
      const result = await removeTableRoomAssignment(date, roomId);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Suítes nesta mesa</Label>
      {forThisTable.length > 0 && (
        <div className="space-y-1">
          {forThisTable.map((a) => (
            <div
              key={a.room_id}
              className="flex items-center justify-between gap-2 rounded bg-muted px-2 py-1 text-xs"
            >
              <span>
                Suíte {roomById.get(a.room_id)?.number ?? "—"} · {a.guest_count} hóspede
                {a.guest_count === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemove(a.room_id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover suíte desta mesa"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {availableRooms.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Select value={newRoomId} onValueChange={(v) => setNewRoomId(v ?? "")} disabled={isPending}>
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue placeholder="Suíte" />
            </SelectTrigger>
            <SelectContent>
              {availableRooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  Suíte {r.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            className="h-7 w-14 text-xs"
            value={newGuestCount}
            onChange={(e) => setNewGuestCount(e.target.value)}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isPending || !newRoomId}
            onClick={handleAdd}
          >
            <Plus size={12} />
          </Button>
        </div>
      )}
    </div>
  );
}

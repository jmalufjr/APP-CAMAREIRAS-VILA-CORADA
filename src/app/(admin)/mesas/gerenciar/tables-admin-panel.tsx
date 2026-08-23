"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable, CommissionSettings } from "@/lib/types";
import {
  createBreakfastTable,
  deleteBreakfastTable,
  saveTableLayout,
  setGuestCount,
  setTableNotes,
  updateCommissionValue,
  type TablePosition,
} from "@/lib/actions/tables";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { TableLayoutCanvas } from "@/components/shared/table-layout-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

export function TablesAdminPanel({
  tables,
  commission,
  todayCounts,
  tomorrowCounts,
  todayNotes,
  tomorrowNotes,
}: {
  tables: BreakfastTable[];
  commission: CommissionSettings;
  todayCounts: Record<string, number>;
  tomorrowCounts: Record<string, number>;
  todayNotes: Record<string, string>;
  tomorrowNotes: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [pendingPositions, setPendingPositions] = useState<TablePosition[] | null>(null);
  const [commissionValue, setCommissionValue] = useState(String(commission?.value_per_table ?? 10));

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
          <TabsTrigger value="hoje">Hóspedes de hoje</TabsTrigger>
          <TabsTrigger value="amanha">Hóspedes de amanhã</TabsTrigger>
          <TabsTrigger value="layout">Layout & mesas</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="pt-4">
          <GuestCountEditor
            date={todayKey()}
            label={formatDatePt(todayKey())}
            tables={tables}
            counts={todayCounts}
            notesInit={todayNotes}
          />
        </TabsContent>
        <TabsContent value="amanha" className="pt-4">
          <GuestCountEditor
            date={tomorrowKey()}
            label={formatDatePt(tomorrowKey())}
            tables={tables}
            counts={tomorrowCounts}
            notesInit={tomorrowNotes}
          />
        </TabsContent>

        <TabsContent value="layout" className="pt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-muted-foreground">Arraste as mesas para reorganizar o layout.</p>
            <div className="flex gap-2">
              <NewTableForm />
              {pendingPositions && (
                <Button
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await saveTableLayout(pendingPositions);
                      toast.success("Layout salvo.");
                      setPendingPositions(null);
                      router.refresh();
                    })
                  }
                >
                  Salvar layout
                </Button>
              )}
            </div>
          </div>
          <TableLayoutCanvas tables={tables} editable onPositionsChange={setPendingPositions} />
          <div className="grid sm:grid-cols-2 gap-3">
            {tables.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 bg-card">
                <div>
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.shape === "round" ? "Redonda" : "Retangular"} · {t.seats} lugares
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!confirm(`Excluir ${t.label}?`)) return;
                    startTransition(async () => {
                      await deleteBreakfastTable(t.id);
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MAX_GUESTS_PER_TABLE = 10;

function GuestCountEditor({
  date,
  label,
  tables,
  counts,
  notesInit,
}: {
  date: string;
  label: string;
  tables: BreakfastTable[];
  counts: Record<string, number>;
  notesInit: Record<string, string>;
}) {
  const [values, setValues] = useState(counts);
  const [notes, setNotes] = useState(notesInit);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const total = Object.values(values).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm capitalize text-muted-foreground">{label}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {tables.filter((t) => t.active).map((t) => (
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

function NewTableForm() {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState("round");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus size={16} /> Nova mesa
      </Button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      action={(formData) => {
        startTransition(async () => {
          const result = await createBreakfastTable(formData);
          if (result?.error) toast.error(result.error);
          else {
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <Input name="label" placeholder="Nome" className="w-28" required />
      <Select value={shape} onValueChange={(v) => setShape(v ?? "round")}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="round">Redonda</SelectItem>
          <SelectItem value="rect">Retangular</SelectItem>
        </SelectContent>
      </Select>
      <input type="hidden" name="shape" value={shape} />
      <Input name="seats" type="number" defaultValue={2} min={1} className="w-16" />
      <Button type="submit" size="sm" disabled={isPending}>Adicionar</Button>
    </form>
  );
}

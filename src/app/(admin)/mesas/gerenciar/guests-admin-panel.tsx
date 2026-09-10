"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable, CommissionSettings } from "@/lib/types";
import { setGuestCount, setTableNotes, updateCommissionValue } from "@/lib/actions/tables";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function GuestsAdminPanel({
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

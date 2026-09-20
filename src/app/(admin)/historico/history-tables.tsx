"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_TYPE_OPTIONS } from "@/lib/task-type";
import { durationMinutes, formatMinutesPt, effectiveServiceStart } from "@/lib/date";
import type { ChecklistType } from "@/lib/types";
import { Download } from "lucide-react";

// Uma linha por suíte servida no café num dia (vem de
// daily_breakfast_room_assignments — no máximo 1 por suíte/dia).
interface BreakfastRow {
  date: string;
  guest_count: number;
}
interface TaskRow {
  date: string;
  task_type: ChecklistType;
  camareira: string;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  occurrences: number;
  occurrencesResolved: number;
}

type ByType = Record<ChecklistType, number>;

interface DayStats {
  suites: number;
  hospedes: number;
  comissao: number;
  byType: ByType;
  ocorrencias: number;
  ocorrenciasResolvidas: number;
}

const emptyByType = (): ByType =>
  Object.fromEntries(TASK_TYPE_OPTIONS.map((o) => [o.value, 0])) as ByType;

const emptyDayStats = (): DayStats => ({
  suites: 0,
  hospedes: 0,
  comissao: 0,
  byType: emptyByType(),
  ocorrencias: 0,
  ocorrenciasResolvidas: 0,
});

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function HistoryTables({
  breakfast,
  commissionRate,
  tasks,
}: {
  breakfast: BreakfastRow[];
  commissionRate: number;
  tasks: TaskRow[];
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, DayStats>();
    breakfast.forEach((b) => {
      const entry = map.get(b.date) ?? emptyDayStats();
      entry.suites += 1;
      entry.hospedes += b.guest_count;
      entry.comissao += commissionRate;
      map.set(b.date, entry);
    });
    tasks.forEach((t) => {
      const entry = map.get(t.date) ?? emptyDayStats();
      entry.byType[t.task_type] += 1;
      entry.ocorrencias += t.occurrences;
      entry.ocorrenciasResolvidas += t.occurrencesResolved;
      map.set(t.date, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [breakfast, commissionRate, tasks]);

  const byCamareira = useMemo(() => {
    const map = new Map<
      string,
      { byType: ByType; ocorrencias: number; ocorrenciasResolvidas: number; durationSumMin: number; durationCount: number }
    >();
    tasks.forEach((t) => {
      const entry =
        map.get(t.camareira) ??
        { byType: emptyByType(), ocorrencias: 0, ocorrenciasResolvidas: 0, durationSumMin: 0, durationCount: 0 };
      entry.byType[t.task_type] += 1;
      entry.ocorrencias += t.occurrences;
      entry.ocorrenciasResolvidas += t.occurrencesResolved;
      const mins = durationMinutes(effectiveServiceStart(t.claimed_at, t.started_at), t.finished_at);
      if (mins !== null) {
        entry.durationSumMin += mins;
        entry.durationCount += 1;
      }
      map.set(t.camareira, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const totals = useMemo(() => {
    const t = emptyDayStats();
    byDay.forEach(([, v]) => {
      t.suites += v.suites;
      t.hospedes += v.hospedes;
      t.comissao += v.comissao;
      t.ocorrencias += v.ocorrencias;
      t.ocorrenciasResolvidas += v.ocorrenciasResolvidas;
      TASK_TYPE_OPTIONS.forEach((o) => {
        t.byType[o.value] += v.byType[o.value];
      });
    });
    return t;
  }, [byDay]);

  const diarioColSpan = 3 + TASK_TYPE_OPTIONS.length + 3;
  const camareiraColSpan = 1 + TASK_TYPE_OPTIONS.length + 3;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Resumo diário</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv("historico-diario.csv", [
                [
                  "Data",
                  "Suítes no café",
                  "Hóspedes café",
                  ...TASK_TYPE_OPTIONS.map((o) => `Qtd. ${o.label}`),
                  "Ocorrências Manutenção",
                  "Ocorrências Manutenção resolvidas",
                  "Comissão (R$)",
                ],
                ...byDay.map(([date, v]) => [
                  date,
                  v.suites,
                  v.hospedes,
                  ...TASK_TYPE_OPTIONS.map((o) => v.byType[o.value]),
                  v.ocorrencias,
                  v.ocorrenciasResolvidas,
                  v.comissao.toFixed(2),
                ]),
              ])
            }
          >
            <Download size={14} /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Suítes no café</TableHead>
                <TableHead>Hóspedes café</TableHead>
                {TASK_TYPE_OPTIONS.map((o) => (
                  <TableHead key={o.value}>Qtd. {o.label}</TableHead>
                ))}
                <TableHead>Ocorrências Manutenção</TableHead>
                <TableHead>Ocorrências resolvidas</TableHead>
                <TableHead>Comissão (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.map(([date, v]) => (
                <TableRow key={date}>
                  <TableCell>{date.split("-").reverse().join("/")}</TableCell>
                  <TableCell>{v.suites}</TableCell>
                  <TableCell>{v.hospedes}</TableCell>
                  {TASK_TYPE_OPTIONS.map((o) => (
                    <TableCell key={o.value}>{v.byType[o.value]}</TableCell>
                  ))}
                  <TableCell>{v.ocorrencias}</TableCell>
                  <TableCell>{v.ocorrenciasResolvidas}</TableCell>
                  <TableCell>R$ {v.comissao.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {byDay.length === 0 && (
                <TableRow>
                  <TableCell colSpan={diarioColSpan} className="text-center text-muted-foreground py-8">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {byDay.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell>{totals.suites}</TableCell>
                  <TableCell>{totals.hospedes}</TableCell>
                  {TASK_TYPE_OPTIONS.map((o) => (
                    <TableCell key={o.value}>{totals.byType[o.value]}</TableCell>
                  ))}
                  <TableCell>{totals.ocorrencias}</TableCell>
                  <TableCell>{totals.ocorrenciasResolvidas}</TableCell>
                  <TableCell>R$ {totals.comissao.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Por camareira</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv("historico-camareiras.csv", [
                [
                  "Camareira",
                  ...TASK_TYPE_OPTIONS.map((o) => o.label),
                  "Ocorrências Manutenção",
                  "Ocorrências Manutenção resolvidas",
                  "Duração média",
                  "Total",
                ],
                ...byCamareira.map(([name, v]) => [
                  name,
                  ...TASK_TYPE_OPTIONS.map((o) => v.byType[o.value]),
                  v.ocorrencias,
                  v.ocorrenciasResolvidas,
                  v.durationCount > 0 ? formatMinutesPt(v.durationSumMin / v.durationCount) : "—",
                  TASK_TYPE_OPTIONS.reduce((sum, o) => sum + v.byType[o.value], 0),
                ]),
              ])
            }
          >
            <Download size={14} /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camareira</TableHead>
                {TASK_TYPE_OPTIONS.map((o) => (
                  <TableHead key={o.value}>{o.label}</TableHead>
                ))}
                <TableHead>Ocorrências Manutenção</TableHead>
                <TableHead>Ocorrências resolvidas</TableHead>
                <TableHead>Duração média</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCamareira.map(([name, v]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  {TASK_TYPE_OPTIONS.map((o) => (
                    <TableCell key={o.value}>{v.byType[o.value]}</TableCell>
                  ))}
                  <TableCell>{v.ocorrencias}</TableCell>
                  <TableCell>{v.ocorrenciasResolvidas}</TableCell>
                  <TableCell>{v.durationCount > 0 ? formatMinutesPt(v.durationSumMin / v.durationCount) : "—"}</TableCell>
                  <TableCell>{TASK_TYPE_OPTIONS.reduce((sum, o) => sum + v.byType[o.value], 0)}</TableCell>
                </TableRow>
              ))}
              {byCamareira.length === 0 && (
                <TableRow>
                  <TableCell colSpan={camareiraColSpan} className="text-center text-muted-foreground py-8">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import type { ChecklistType } from "@/lib/types";
import { Download } from "lucide-react";

interface BreakfastRow {
  date: string;
  guest_count: number;
  value_per_table_snapshot: number;
}
interface TaskRow {
  date: string;
  task_type: ChecklistType;
  camareira: string;
  occurrences: number;
}

interface DayStats {
  mesas: number;
  hospedes: number;
  comissao: number;
  arrumacao: number;
  preparacao: number;
  troca: number;
  ocorrencias: number;
}

const emptyDayStats = (): DayStats => ({
  mesas: 0,
  hospedes: 0,
  comissao: 0,
  arrumacao: 0,
  preparacao: 0,
  troca: 0,
  ocorrencias: 0,
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

export function HistoryTables({ breakfast, tasks }: { breakfast: BreakfastRow[]; tasks: TaskRow[] }) {
  const byDay = useMemo(() => {
    const map = new Map<string, DayStats>();
    breakfast.forEach((b) => {
      if (b.guest_count <= 0) return;
      const entry = map.get(b.date) ?? emptyDayStats();
      entry.mesas += 1;
      entry.hospedes += b.guest_count;
      entry.comissao += Number(b.value_per_table_snapshot);
      map.set(b.date, entry);
    });
    tasks.forEach((t) => {
      const entry = map.get(t.date) ?? emptyDayStats();
      entry[t.task_type] += 1;
      entry.ocorrencias += t.occurrences;
      map.set(t.date, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [breakfast, tasks]);

  const byCamareira = useMemo(() => {
    const map = new Map<string, Pick<DayStats, "arrumacao" | "preparacao" | "troca" | "ocorrencias">>();
    tasks.forEach((t) => {
      const entry = map.get(t.camareira) ?? { arrumacao: 0, preparacao: 0, troca: 0, ocorrencias: 0 };
      entry[t.task_type] += 1;
      entry.ocorrencias += t.occurrences;
      map.set(t.camareira, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const totals = byDay.reduce(
    (acc, [, v]) => ({
      mesas: acc.mesas + v.mesas,
      hospedes: acc.hospedes + v.hospedes,
      comissao: acc.comissao + v.comissao,
      arrumacao: acc.arrumacao + v.arrumacao,
      preparacao: acc.preparacao + v.preparacao,
      troca: acc.troca + v.troca,
      ocorrencias: acc.ocorrencias + v.ocorrencias,
    }),
    emptyDayStats()
  );

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
                  "Mesas café",
                  "Hóspedes café",
                  `Qtd. ${TASK_TYPE_LABELS.arrumacao}`,
                  `Qtd. ${TASK_TYPE_LABELS.preparacao}`,
                  `Qtd. ${TASK_TYPE_LABELS.troca}`,
                  "Ocorrências Manutenção",
                  "Comissão (R$)",
                ],
                ...byDay.map(([date, v]) => [
                  date,
                  v.mesas,
                  v.hospedes,
                  v.arrumacao,
                  v.preparacao,
                  v.troca,
                  v.ocorrencias,
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
                <TableHead>Mesas café</TableHead>
                <TableHead>Hóspedes café</TableHead>
                <TableHead>Qtd. {TASK_TYPE_LABELS.arrumacao}</TableHead>
                <TableHead>Qtd. {TASK_TYPE_LABELS.preparacao}</TableHead>
                <TableHead>Qtd. {TASK_TYPE_LABELS.troca}</TableHead>
                <TableHead>Ocorrências Manutenção</TableHead>
                <TableHead>Comissão (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.map(([date, v]) => (
                <TableRow key={date}>
                  <TableCell>{date.split("-").reverse().join("/")}</TableCell>
                  <TableCell>{v.mesas}</TableCell>
                  <TableCell>{v.hospedes}</TableCell>
                  <TableCell>{v.arrumacao}</TableCell>
                  <TableCell>{v.preparacao}</TableCell>
                  <TableCell>{v.troca}</TableCell>
                  <TableCell>{v.ocorrencias}</TableCell>
                  <TableCell>R$ {v.comissao.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {byDay.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {byDay.length > 0 && (
              <TableRow className="font-medium bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell>{totals.mesas}</TableCell>
                <TableCell>{totals.hospedes}</TableCell>
                <TableCell>{totals.arrumacao}</TableCell>
                <TableCell>{totals.preparacao}</TableCell>
                <TableCell>{totals.troca}</TableCell>
                <TableCell>{totals.ocorrencias}</TableCell>
                <TableCell>R$ {totals.comissao.toFixed(2)}</TableCell>
              </TableRow>
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
                  TASK_TYPE_LABELS.arrumacao,
                  TASK_TYPE_LABELS.preparacao,
                  TASK_TYPE_LABELS.troca,
                  "Ocorrências Manutenção",
                  "Total",
                ],
                ...byCamareira.map(([name, v]) => [
                  name,
                  v.arrumacao,
                  v.preparacao,
                  v.troca,
                  v.ocorrencias,
                  v.arrumacao + v.preparacao + v.troca,
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
                <TableHead>{TASK_TYPE_LABELS.arrumacao}</TableHead>
                <TableHead>{TASK_TYPE_LABELS.preparacao}</TableHead>
                <TableHead>{TASK_TYPE_LABELS.troca}</TableHead>
                <TableHead>Ocorrências Manutenção</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCamareira.map(([name, v]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{v.arrumacao}</TableCell>
                  <TableCell>{v.preparacao}</TableCell>
                  <TableCell>{v.troca}</TableCell>
                  <TableCell>{v.ocorrencias}</TableCell>
                  <TableCell>{v.arrumacao + v.preparacao + v.troca}</TableCell>
                </TableRow>
              ))}
              {byCamareira.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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

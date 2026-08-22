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
import { Download } from "lucide-react";

interface BreakfastRow {
  date: string;
  guest_count: number;
  value_per_table_snapshot: number;
}
interface TaskRow {
  date: string;
  task_type: "arrumacao" | "preparacao";
  camareira: string;
}

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
    const map = new Map<string, { mesas: number; hospedes: number; comissao: number; arrumados: number; preparados: number }>();
    breakfast.forEach((b) => {
      if (b.guest_count <= 0) return;
      const entry = map.get(b.date) ?? { mesas: 0, hospedes: 0, comissao: 0, arrumados: 0, preparados: 0 };
      entry.mesas += 1;
      entry.hospedes += b.guest_count;
      entry.comissao += Number(b.value_per_table_snapshot);
      map.set(b.date, entry);
    });
    tasks.forEach((t) => {
      const entry = map.get(t.date) ?? { mesas: 0, hospedes: 0, comissao: 0, arrumados: 0, preparados: 0 };
      if (t.task_type === "arrumacao") entry.arrumados += 1;
      else entry.preparados += 1;
      map.set(t.date, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [breakfast, tasks]);

  const byCamareira = useMemo(() => {
    const map = new Map<string, { arrumados: number; preparados: number }>();
    tasks.forEach((t) => {
      const entry = map.get(t.camareira) ?? { arrumados: 0, preparados: 0 };
      if (t.task_type === "arrumacao") entry.arrumados += 1;
      else entry.preparados += 1;
      map.set(t.camareira, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const totals = byDay.reduce(
    (acc, [, v]) => ({
      mesas: acc.mesas + v.mesas,
      hospedes: acc.hospedes + v.hospedes,
      comissao: acc.comissao + v.comissao,
      arrumados: acc.arrumados + v.arrumados,
      preparados: acc.preparados + v.preparados,
    }),
    { mesas: 0, hospedes: 0, comissao: 0, arrumados: 0, preparados: 0 }
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
                ["Data", "Mesas café", "Hóspedes café", "Quartos arrumados", "Quartos preparados", "Comissão (R$)"],
                ...byDay.map(([date, v]) => [date, v.mesas, v.hospedes, v.arrumados, v.preparados, v.comissao.toFixed(2)]),
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
                <TableHead>Qtd. arrumados</TableHead>
                <TableHead>Qtd. preparados</TableHead>
                <TableHead>Comissão (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.map(([date, v]) => (
                <TableRow key={date}>
                  <TableCell>{date.split("-").reverse().join("/")}</TableCell>
                  <TableCell>{v.mesas}</TableCell>
                  <TableCell>{v.hospedes}</TableCell>
                  <TableCell>{v.arrumados}</TableCell>
                  <TableCell>{v.preparados}</TableCell>
                  <TableCell>R$ {v.comissao.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {byDay.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                <TableCell>{totals.arrumados}</TableCell>
                <TableCell>{totals.preparados}</TableCell>
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
                ["Camareira", "Quartos arrumados", "Quartos preparados", "Total"],
                ...byCamareira.map(([name, v]) => [name, v.arrumados, v.preparados, v.arrumados + v.preparados]),
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
                <TableHead>Quartos arrumados</TableHead>
                <TableHead>Quartos preparados</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCamareira.map(([name, v]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{v.arrumados}</TableCell>
                  <TableCell>{v.preparados}</TableCell>
                  <TableCell>{v.arrumados + v.preparados}</TableCell>
                </TableRow>
              ))}
              {byCamareira.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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

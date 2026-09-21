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
import { durationMinutes, formatMinutesPt, effectiveServiceStart, todayKey } from "@/lib/date";
import type { ChecklistType } from "@/lib/types";
import type { CamareiraBarCommissionRow } from "@/lib/actions/comandas";
import { Download } from "lucide-react";

// Uma linha por dia (vem de daily_breakfast_settings, gravada a cada
// sincronização com a Stays): quantas suítes eram elegíveis pro café da
// manhã naquele dia, independente de terem sido de fato alocadas a
// alguma mesa. commission_value_snapshot é o valor da comissão congelado
// no momento em que a linha foi gravada — usado pra meses já fechados (o
// mês corrente sempre usa o valor atual do campo, não esse).
// eligible_suites_count é nulo pra datas anteriores a essa regra existir
// — nesse caso cai pro fallback (regra antiga, ver byDay abaixo) em vez
// de mostrar comissão zerada pra um dia que já tinha valor calculado.
interface EligibilityRow {
  date: string;
  eligible_suites_count: number | null;
  commission_value_snapshot: number;
}

// Uma linha por suíte alocada a uma mesa num dia — só usada aqui pra
// somar o total de hóspedes reais ("Hóspedes café"), estatística separada
// da comissão (que não depende mais da alocação).
interface RoomAssignmentRow {
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
  eligibility,
  roomAssignments,
  commissionRate,
  barCommission,
  tasks,
}: {
  eligibility: EligibilityRow[];
  roomAssignments: RoomAssignmentRow[];
  commissionRate: number;
  barCommission: CamareiraBarCommissionRow[];
  tasks: TaskRow[];
}) {
  // Mês corrente sempre usa o valor atual do campo de comissão (muda na
  // hora se o admin alterar o valor); meses já fechados usam o valor que
  // estava congelado em cada linha no momento em que foi gravada, então
  // ficam parados mesmo que o valor do campo mude depois.
  const currentMonthPrefix = todayKey().slice(0, 7);

  const byDay = useMemo(() => {
    const map = new Map<string, DayStats>();

    // Regra antiga (suítes com alguma mesa naquele dia) — fonte de
    // "Hóspedes café" (sempre) e fallback de "Suítes no café"/comissão
    // pra data sem eligible_suites_count.
    const fallbackSuitesByDate = new Map<string, number>();
    roomAssignments.forEach((r) => {
      fallbackSuitesByDate.set(r.date, (fallbackSuitesByDate.get(r.date) ?? 0) + 1);
      const entry = map.get(r.date) ?? emptyDayStats();
      entry.hospedes += r.guest_count;
      map.set(r.date, entry);
    });

    const eligibilityByDate = new Map<string, EligibilityRow>(eligibility.map((e) => [e.date, e]));
    const allBreakfastDates = new Set<string>([...eligibilityByDate.keys(), ...fallbackSuitesByDate.keys()]);
    allBreakfastDates.forEach((date) => {
      const entry = map.get(date) ?? emptyDayStats();
      const e = eligibilityByDate.get(date);
      if (e && e.eligible_suites_count !== null) {
        entry.suites = e.eligible_suites_count;
        entry.comissao =
          date.slice(0, 7) === currentMonthPrefix
            ? commissionRate * e.eligible_suites_count
            : e.commission_value_snapshot * e.eligible_suites_count;
      } else {
        // Sem eligible_suites_count pra essa data (nunca sincronizada sob
        // a regra nova): cai pra regra antiga, sempre com o valor atual
        // do campo de comissão (não há retrato congelado pra essas linhas).
        const fallbackSuites = fallbackSuitesByDate.get(date) ?? 0;
        entry.suites = fallbackSuites;
        entry.comissao = fallbackSuites * commissionRate;
      }
      map.set(date, entry);
    });

    tasks.forEach((t) => {
      const entry = map.get(t.date) ?? emptyDayStats();
      entry.byType[t.task_type] += 1;
      entry.ocorrencias += t.occurrences;
      entry.ocorrenciasResolvidas += t.occurrencesResolved;
      map.set(t.date, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [eligibility, roomAssignments, commissionRate, currentMonthPrefix, tasks]);

  const byCamareira = useMemo(() => {
    const map = new Map<
      string,
      {
        byType: ByType;
        ocorrencias: number;
        ocorrenciasResolvidas: number;
        durationSumMin: number;
        durationCount: number;
        barCommission: number;
      }
    >();
    const empty = () => ({
      byType: emptyByType(),
      ocorrencias: 0,
      ocorrenciasResolvidas: 0,
      durationSumMin: 0,
      durationCount: 0,
      barCommission: 0,
    });
    tasks.forEach((t) => {
      const entry = map.get(t.camareira) ?? empty();
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
    // Camareiras que só lançaram comandas de bar no período (sem nenhum
    // serviço de suíte) também entram — colunas de serviço ficam zeradas.
    barCommission.forEach((c) => {
      const entry = map.get(c.camareira_name) ?? empty();
      entry.barCommission += c.commission;
      map.set(c.camareira_name, entry);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, barCommission]);

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
  const camareiraServicosColSpan = 1 + TASK_TYPE_OPTIONS.length + 2;

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
          <CardTitle className="font-heading text-lg">Por camareira — serviços</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv("historico-camareiras.csv", [
                [
                  "Camareira",
                  ...TASK_TYPE_OPTIONS.map((o) => o.label),
                  "Total",
                  "Duração média",
                  "Ocorrências Manutenção",
                  "Ocorrências Manutenção resolvidas",
                  "Total 10% bar no período (R$)",
                ],
                ...byCamareira.map(([name, v]) => [
                  name,
                  ...TASK_TYPE_OPTIONS.map((o) => v.byType[o.value]),
                  TASK_TYPE_OPTIONS.reduce((sum, o) => sum + v.byType[o.value], 0),
                  v.durationCount > 0 ? formatMinutesPt(v.durationSumMin / v.durationCount) : "—",
                  v.ocorrencias,
                  v.ocorrenciasResolvidas,
                  v.barCommission.toFixed(2),
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
                <TableHead>Total</TableHead>
                <TableHead>Duração média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCamareira.map(([name, v]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  {TASK_TYPE_OPTIONS.map((o) => (
                    <TableCell key={o.value}>{v.byType[o.value]}</TableCell>
                  ))}
                  <TableCell>{TASK_TYPE_OPTIONS.reduce((sum, o) => sum + v.byType[o.value], 0)}</TableCell>
                  <TableCell>{v.durationCount > 0 ? formatMinutesPt(v.durationSumMin / v.durationCount) : "—"}</TableCell>
                </TableRow>
              ))}
              {byCamareira.length === 0 && (
                <TableRow>
                  <TableCell colSpan={camareiraServicosColSpan} className="text-center text-muted-foreground py-8">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Por camareira — ocorrências e comissão de bar</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camareira</TableHead>
                <TableHead>Ocorrências Manutenção</TableHead>
                <TableHead>Ocorrências resolvidas</TableHead>
                <TableHead>Total 10% bar no período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCamareira.map(([name, v]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{v.ocorrencias}</TableCell>
                  <TableCell>{v.ocorrenciasResolvidas}</TableCell>
                  <TableCell>R$ {v.barCommission.toFixed(2)}</TableCell>
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

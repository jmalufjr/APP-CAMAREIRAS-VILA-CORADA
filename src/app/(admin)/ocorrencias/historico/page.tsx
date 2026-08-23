import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { daysAgoKey, todayKey } from "@/lib/date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface TaskRow {
  date: string;
  notes: string | null;
  rooms: { number: string } | null;
  daily_room_task_occurrences: { id: string }[];
}

export default async function OcorrenciasHistoricoPage() {
  const supabase = await createClient();
  const from = daysAgoKey(30);
  const to = todayKey();

  const { data: tasks } = await supabase
    .from("daily_room_tasks")
    .select("date, notes, rooms(number), daily_room_task_occurrences(id)")
    .gte("date", from)
    .lte("date", to);

  const rows = (tasks ?? []) as unknown as TaskRow[];

  const byDate = new Map<string, { ocorrencias: number; quartosComOcorrencia: Set<string>; observacoes: number }>();
  rows.forEach((t) => {
    const entry = byDate.get(t.date) ?? { ocorrencias: 0, quartosComOcorrencia: new Set<string>(), observacoes: 0 };
    if (t.daily_room_task_occurrences.length > 0) {
      entry.ocorrencias += t.daily_room_task_occurrences.length;
      entry.quartosComOcorrencia.add(t.rooms?.number ?? "");
    }
    if (t.notes) entry.observacoes += 1;
    byDate.set(t.date, entry);
  });

  const byDay = Array.from(byDate.entries())
    .filter(([, v]) => v.ocorrencias > 0 || v.observacoes > 0)
    .sort(([a], [b]) => b.localeCompare(a));

  const totals = byDay.reduce(
    (acc, [, v]) => ({
      ocorrencias: acc.ocorrencias + v.ocorrencias,
      quartos: acc.quartos + v.quartosComOcorrencia.size,
      observacoes: acc.observacoes + v.observacoes,
    }),
    { ocorrencias: 0, quartos: 0, observacoes: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de ocorrências"
        subtitle="Resumo dos últimos 30 dias."
      />

      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Total de ocorrências</TableHead>
                <TableHead>Quartos com ocorrência</TableHead>
                <TableHead>Quartos com observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.map(([date, v]) => (
                <TableRow key={date}>
                  <TableCell>
                    <Link href={`/ocorrencias/${date}`} className="text-primary hover:underline font-medium">
                      {date.split("-").reverse().join("/")}
                    </Link>
                  </TableCell>
                  <TableCell>{v.ocorrencias}</TableCell>
                  <TableCell>{v.quartosComOcorrencia.size}</TableCell>
                  <TableCell>{v.observacoes}</TableCell>
                </TableRow>
              ))}
              {byDay.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma ocorrência ou observação nos últimos 30 dias.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {byDay.length > 0 && (
              <TableRow className="font-medium bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell>{totals.ocorrencias}</TableCell>
                <TableCell>{totals.quartos}</TableCell>
                <TableCell>{totals.observacoes}</TableCell>
              </TableRow>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

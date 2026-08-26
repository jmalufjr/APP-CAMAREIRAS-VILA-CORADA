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
import { TopCategoriesTable, type CategoryCount } from "@/components/shared/top-categories-table";
import Link from "next/link";

interface TaskRow {
  date: string;
  notes: string | null;
  rooms: { number: string } | null;
  daily_room_task_occurrences: {
    id: string;
    status: string;
    occurrence_categories: { name: string } | null;
  }[];
}

export default async function OcorrenciasHistoricoPage() {
  const supabase = await createClient();
  const from = daysAgoKey(30);
  const to = todayKey();

  const { data: tasks } = await supabase
    .from("daily_room_tasks")
    .select(
      "date, notes, rooms(number), daily_room_task_occurrences(id, status, occurrence_categories(name))"
    )
    .gte("date", from)
    .lte("date", to);

  const rows = (tasks ?? []) as unknown as TaskRow[];

  const categoryTally = new Map<string, number>();
  rows.forEach((t) => {
    t.daily_room_task_occurrences.forEach((o) => {
      const name = o.occurrence_categories?.name;
      if (!name) return;
      categoryTally.set(name, (categoryTally.get(name) ?? 0) + 1);
    });
  });
  const topCategories: CategoryCount[] = Array.from(categoryTally.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const byDate = new Map<
    string,
    { ocorrencias: number; resolvidas: number; quartosComOcorrencia: Set<string>; observacoes: number }
  >();
  rows.forEach((t) => {
    const entry =
      byDate.get(t.date) ?? {
        ocorrencias: 0,
        resolvidas: 0,
        quartosComOcorrencia: new Set<string>(),
        observacoes: 0,
      };
    if (t.daily_room_task_occurrences.length > 0) {
      entry.ocorrencias += t.daily_room_task_occurrences.length;
      entry.resolvidas += t.daily_room_task_occurrences.filter((o) => o.status === "resolvida").length;
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
      resolvidas: acc.resolvidas + v.resolvidas,
      quartos: acc.quartos + v.quartosComOcorrencia.size,
      observacoes: acc.observacoes + v.observacoes,
    }),
    { ocorrencias: 0, resolvidas: 0, quartos: 0, observacoes: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de ocorrências manutenção"
        subtitle="Resumo dos últimos 30 dias."
      />

      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Total de ocorrências manutenção</TableHead>
                <TableHead>Resolvidas</TableHead>
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
                  <TableCell>{v.resolvidas}</TableCell>
                  <TableCell>{v.quartosComOcorrencia.size}</TableCell>
                  <TableCell>{v.observacoes}</TableCell>
                </TableRow>
              ))}
              {byDay.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma ocorrência ou observação nos últimos 30 dias.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {byDay.length > 0 && (
              <TableRow className="font-medium bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell>{totals.ocorrencias}</TableCell>
                <TableCell>{totals.resolvidas}</TableCell>
                <TableCell>{totals.quartos}</TableCell>
                <TableCell>{totals.observacoes}</TableCell>
              </TableRow>
            )}
          </Table>
        </CardContent>
      </Card>

      <TopCategoriesTable
        title="10 categorias de ocorrências manutenção mais frequentes nos últimos 30 dias"
        categories={topCategories}
      />
    </div>
  );
}

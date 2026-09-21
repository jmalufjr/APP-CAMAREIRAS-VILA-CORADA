import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { HistoryFilters } from "./history-filters";
import { HistoryTables } from "./history-tables";
import { TopCategoriesTable, type CategoryCount } from "@/components/shared/top-categories-table";
import { MinibarSummaryTable } from "@/components/shared/minibar-summary-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getMinibarConsumptionForPeriod } from "@/lib/actions/minibar";
import { getPoolbarConsumptionForPeriod } from "@/lib/actions/poolbar";
import { getBarCommissionByCamareiraForPeriod } from "@/lib/actions/comandas";
import { toDateKey, nowInBrazil } from "@/lib/date";
import type { ChecklistType } from "@/lib/types";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}

interface TaskWithOccurrences {
  date: string;
  task_type: ChecklistType;
  status: string;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  profiles: { name: string } | null;
  daily_room_task_occurrences: {
    id: string;
    status: string;
    occurrence_categories: { name: string } | null;
  }[];
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;

  const supabase = await createClient();

  const [
    { data: eligibility },
    { data: roomAssignments },
    { data: commissionSettings },
    { data: tasks },
    minibarSummary,
    poolbarSummary,
    barCommission,
  ] = await Promise.all([
    // Comissão = quantidade de suítes elegíveis pro café da manhã por dia
    // (independente de terem sido de fato alocadas a uma mesa) × valor por
    // café servido, gravada a cada sincronização com a Stays.
    supabase
      .from("daily_breakfast_settings")
      .select("date, eligible_suites_count, commission_value_snapshot")
      .gte("date", from)
      .lte("date", to),
    // "Hóspedes café": soma dos hóspedes reais por suíte alocada (estatística
    // separada da comissão, não usada pra calculá-la).
    supabase.from("daily_breakfast_room_assignments").select("date, guest_count").gte("date", from).lte("date", to),
    supabase.from("commission_settings").select("value_per_table").single(),
    supabase
      .from("daily_room_tasks")
      .select(
        "date, task_type, status, assigned_to, claimed_at, started_at, finished_at, profiles!daily_room_tasks_assigned_to_fkey(name), daily_room_task_occurrences(id, status, occurrence_categories(name))"
      )
      .gte("date", from)
      .lte("date", to)
      .eq("status", "concluido"),
    getMinibarConsumptionForPeriod(from, to),
    getPoolbarConsumptionForPeriod(from, to),
    getBarCommissionByCamareiraForPeriod(from, to),
  ]);

  const commissionRate = Number(commissionSettings?.value_per_table ?? 0);

  const taskRows = (tasks ?? []) as unknown as TaskWithOccurrences[];

  const categoryTally = new Map<string, number>();
  taskRows.forEach((t) => {
    t.daily_room_task_occurrences.forEach((o) => {
      const name = o.occurrence_categories?.name;
      if (!name) return;
      categoryTally.set(name, (categoryTally.get(name) ?? 0) + 1);
    });
  });
  const topCategories: CategoryCount[] = Array.from(categoryTally.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <PageHeader title="Histórico" subtitle="Dados diários, mensais e anuais consolidados." />
      <HistoryFilters from={from} to={to} />
      <HistoryTables
        eligibility={eligibility ?? []}
        roomAssignments={roomAssignments ?? []}
        commissionRate={commissionRate}
        barCommission={barCommission}
        tasks={taskRows.map((t) => ({
          date: t.date,
          task_type: t.task_type,
          camareira: t.profiles?.name ?? "—",
          claimed_at: t.claimed_at,
          started_at: t.started_at,
          finished_at: t.finished_at,
          occurrences: t.daily_room_task_occurrences.length,
          occurrencesResolved: t.daily_room_task_occurrences.filter((o) => o.status === "resolvida").length,
        }))}
      />
      <TopCategoriesTable
        title="10 categorias de ocorrências manutenção mais frequentes no período"
        categories={topCategories}
        csvFilename="historico-categorias-ocorrencias.csv"
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Consumo de frigobar no período · R$ {minibarSummary.total.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MinibarSummaryTable items={minibarSummary.items} total={minibarSummary.total} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Consumo de bar da piscina no período · R$ {poolbarSummary.total.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MinibarSummaryTable items={poolbarSummary.items} total={poolbarSummary.total} />
        </CardContent>
      </Card>
    </div>
  );
}

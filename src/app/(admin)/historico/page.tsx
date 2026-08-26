import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { HistoryFilters } from "./history-filters";
import { HistoryTables } from "./history-tables";
import { TopCategoriesTable, type CategoryCount } from "@/components/shared/top-categories-table";
import { toDateKey } from "@/lib/date";

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateKey(start), to: toDateKey(now) };
}

interface TaskWithOccurrences {
  date: string;
  task_type: "arrumacao" | "preparacao" | "troca";
  status: string;
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

  const [{ data: breakfast }, { data: tasks }] = await Promise.all([
    supabase
      .from("daily_breakfast")
      .select("date, guest_count, value_per_table_snapshot")
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("daily_room_tasks")
      .select(
        "date, task_type, status, assigned_to, profiles!daily_room_tasks_assigned_to_fkey(name), daily_room_task_occurrences(id, status, occurrence_categories(name))"
      )
      .gte("date", from)
      .lte("date", to)
      .eq("status", "concluido"),
  ]);

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
        breakfast={breakfast ?? []}
        tasks={taskRows.map((t) => ({
          date: t.date,
          task_type: t.task_type,
          camareira: t.profiles?.name ?? "—",
          occurrences: t.daily_room_task_occurrences.length,
          occurrencesResolved: t.daily_room_task_occurrences.filter((o) => o.status === "resolvida").length,
        }))}
      />
      <TopCategoriesTable
        title="10 categorias de ocorrências manutenção mais frequentes no período"
        categories={topCategories}
        csvFilename="historico-categorias-ocorrencias.csv"
      />
    </div>
  );
}

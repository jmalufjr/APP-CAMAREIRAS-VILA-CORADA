import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { HistoryFilters } from "./history-filters";
import { HistoryTables } from "./history-tables";
import { toDateKey } from "@/lib/date";

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateKey(start), to: toDateKey(now) };
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
      .select("date, task_type, status, assigned_to, profiles!daily_room_tasks_assigned_to_fkey(name)")
      .gte("date", from)
      .lte("date", to)
      .eq("status", "concluido"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Histórico" subtitle="Dados diários, mensais e anuais consolidados." />
      <HistoryFilters from={from} to={to} />
      <HistoryTables
        breakfast={breakfast ?? []}
        tasks={
          (tasks ?? []).map((t) => ({
            date: t.date,
            task_type: t.task_type,
            camareira: (t as unknown as { profiles: { name: string } | null }).profiles?.name ?? "—",
          }))
        }
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey, formatDatePt } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableLayoutCanvas } from "@/components/shared/table-layout-canvas";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MonthlyChart } from "./monthly-chart";
import type { BreakfastTable, ChecklistType } from "@/lib/types";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { BedDouble, Coffee, AlertTriangle, Wallet, History } from "lucide-react";
import Link from "next/link";

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const { start, end } = monthRange();

  const [
    { data: todayTasks },
    { data: tomorrowTasks },
    { data: tables },
    { data: todayGuests },
    { data: tomorrowGuests },
    { data: monthBreakfast },
    { count: occurrencesToday },
  ] = await Promise.all([
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", today),
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", tomorrow),
    supabase.from("breakfast_tables").select("*").eq("active", true),
    supabase.from("daily_breakfast").select("table_id, guest_count").eq("date", today),
    supabase.from("daily_breakfast").select("table_id, guest_count").eq("date", tomorrow),
    supabase
      .from("daily_breakfast")
      .select("date, guest_count, value_per_table_snapshot")
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("daily_room_task_occurrences")
      .select("id, daily_room_tasks!inner(date)", { count: "exact", head: true })
      .eq("daily_room_tasks.date", today),
  ]);

  const doneToday = (todayTasks ?? []).filter((t) => t.status === "concluido").length;
  const totalToday = (todayTasks ?? []).length;

  const occupiedThisMonth = (monthBreakfast ?? []).filter((r) => r.guest_count > 0);
  const totalTablesMonth = occupiedThisMonth.length;
  const totalCommissionMonth = occupiedThisMonth.reduce(
    (sum, r) => sum + Number(r.value_per_table_snapshot),
    0
  );

  const dailyMap = new Map<string, { tables: number; commission: number }>();
  occupiedThisMonth.forEach((r) => {
    const entry = dailyMap.get(r.date) ?? { tables: 0, commission: 0 };
    entry.tables += 1;
    entry.commission += Number(r.value_per_table_snapshot);
    dailyMap.set(r.date, entry);
  });
  const chartData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date: date.slice(8, 10), mesas: v.tables, comissao: v.commission }));

  const todayGuestMap: Record<string, number> = Object.fromEntries(
    (todayGuests ?? []).map((r) => [r.table_id, r.guest_count] as const)
  );
  const tomorrowGuestMap: Record<string, number> = Object.fromEntries(
    (tomorrowGuests ?? []).map((r) => [r.table_id, r.guest_count] as const)
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle={`Resumo de hoje, ${formatDatePt(today)}`}
        action={<ThemeToggle />}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BedDouble}
          label="Quartos concluídos hoje"
          value={`${doneToday} / ${totalToday}`}
        />
        <StatCard
          icon={Coffee}
          label="Mesas de café hoje"
          value={String(Object.values(todayGuestMap).filter((v) => v > 0).length)}
        />
        <StatCard
          icon={Wallet}
          label="Comissão do mês"
          value={`R$ ${totalCommissionMonth.toFixed(2)}`}
        />
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="size-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
              <AlertTriangle size={20} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ocorrências hoje</p>
              <p className="text-xl font-heading">{occurrencesToday ?? 0}</p>
              <div className="flex items-center gap-2 mt-1">
                <Link href="/ocorrencias" className="text-xs text-secondary hover:underline">
                  Ver detalhes
                </Link>
                <span className="text-xs text-muted-foreground">·</span>
                <Link
                  href="/ocorrencias/historico"
                  className="text-xs text-secondary hover:underline inline-flex items-center gap-1"
                >
                  <History size={11} /> Histórico
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Quartos de hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(todayTasks ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>
                  Quarto {(t as unknown as { rooms: { number: string } }).rooms.number} ·{" "}
                  {TASK_TYPE_LABELS[t.task_type as ChecklistType]}
                </span>
                <Badge variant={t.status === "concluido" ? "default" : "secondary"}>
                  {t.status === "concluido" ? "Concluído" : t.status === "em_andamento" ? "Em andamento" : "Pendente"}
                </Badge>
              </div>
            ))}
            {(todayTasks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhum quarto planejado para hoje.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Quartos de amanhã</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(tomorrowTasks ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>Quarto {(t as unknown as { rooms: { number: string } }).rooms.number}</span>
                <Badge variant="outline">{TASK_TYPE_LABELS[t.task_type as ChecklistType]}</Badge>
              </div>
            ))}
            {(tomorrowTasks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Planejamento de amanhã ainda não definido.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Totais do mês · {totalTablesMonth} mesas · R$ {totalCommissionMonth.toFixed(2)} de comissão</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Mesas · hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <TableLayoutCanvas tables={(tables ?? []) as BreakfastTable[]} guestCounts={todayGuestMap} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Mesas · amanhã</CardTitle>
          </CardHeader>
          <CardContent>
            <TableLayoutCanvas tables={(tables ?? []) as BreakfastTable[]} guestCounts={tomorrowGuestMap} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="size-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-heading">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

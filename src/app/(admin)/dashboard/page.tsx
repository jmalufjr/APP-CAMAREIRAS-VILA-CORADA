import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, tomorrowKey, daysAgoKey, formatDatePt, nowInBrazil } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MonthlyChart } from "./monthly-chart";
import { MinibarPieChart } from "./minibar-pie-chart";
import { MinibarSummaryTable } from "@/components/shared/minibar-summary-table";
import { ServiceLogTable, type ServiceLogRow } from "./service-log-table";
import { getMinibarMonthlySummary } from "@/lib/actions/minibar";
import { getPoolbarMonthlySummary } from "@/lib/actions/poolbar";
import type { ChecklistType } from "@/lib/types";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { BedDouble, Coffee, AlertTriangle, Wallet, History } from "lucide-react";
import Link from "next/link";

function monthRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const { start, end } = monthRange();

  const sevenDaysAgo = daysAgoKey(6);

  const [
    { data: todayTasks },
    { data: tomorrowTasks },
    { data: monthAssignments },
    { data: commissionSettings },
    { count: occurrencesToday },
    { data: serviceLog },
    minibarSummary,
    poolbarSummary,
  ] = await Promise.all([
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", today),
    supabase.from("daily_room_tasks").select("*, rooms(number)").eq("date", tomorrow),
    // Comissão do dia = quantidade de suítes servidas no café (uma linha
    // por suíte/dia aqui, independente de mesa/hóspedes) × valor por café
    // servido — ver CLAUDE.md sobre a mudança do modelo "por mesa" pro
    // modelo "por suíte servida".
    supabase.from("daily_breakfast_room_assignments").select("date, room_id").gte("date", start).lte("date", end),
    supabase.from("commission_settings").select("value_per_table").single(),
    supabase
      .from("daily_room_task_occurrences")
      .select("id, daily_room_tasks!inner(date)", { count: "exact", head: true })
      .eq("daily_room_tasks.date", today),
    // Serviço concluído pelas camareiras nos últimos 7 dias, para a tabela
    // "Serviços dos últimos 7 dias" abaixo dos cards de hoje/amanhã.
    supabase
      .from("daily_room_tasks")
      .select(
        "id, date, task_type, claimed_at, started_at, finished_at, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name)"
      )
      .gte("date", sevenDaysAgo)
      .lte("date", today)
      .eq("status", "concluido"),
    getMinibarMonthlySummary(),
    getPoolbarMonthlySummary(),
  ]);

  const serviceLogRows: ServiceLogRow[] = (
    (serviceLog ?? []) as unknown as {
      id: string;
      date: string;
      task_type: ChecklistType;
      claimed_at: string | null;
      started_at: string | null;
      finished_at: string | null;
      rooms: { number: string };
      profiles: { name: string } | null;
    }[]
  )
    .map((r) => ({
      id: r.id,
      date: r.date,
      room_number: r.rooms.number,
      task_type: r.task_type,
      claimed_at: r.claimed_at,
      started_at: r.started_at,
      finished_at: r.finished_at,
      camareira_name: r.profiles?.name ?? null,
    }))
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : Number(a.room_number) - Number(b.room_number)));

  const doneToday = (todayTasks ?? []).filter((t) => t.status === "concluido").length;
  const totalToday = (todayTasks ?? []).length;

  const commissionRate = Number(commissionSettings?.value_per_table ?? 0);

  // Uma linha em daily_breakfast_room_assignments = uma suíte servida
  // naquele dia (a tabela já garante no máximo 1 linha por suíte/dia), daí
  // contar linhas por data já dá a quantidade de suítes servidas por dia.
  const suitesByDate = new Map<string, number>();
  (monthAssignments ?? []).forEach((r) => {
    suitesByDate.set(r.date, (suitesByDate.get(r.date) ?? 0) + 1);
  });

  const totalSuitesMonth = Array.from(suitesByDate.values()).reduce((sum, n) => sum + n, 0);
  const totalCommissionMonth = totalSuitesMonth * commissionRate;
  const suitesToday = suitesByDate.get(today) ?? 0;

  const chartData = Array.from(suitesByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, n]) => ({ date: date.slice(8, 10), suites: n, comissao: n * commissionRate }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resumo executivo"
        subtitle={`Resumo de hoje, ${formatDatePt(today)}`}
        action={<ThemeToggle />}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BedDouble}
          label="Suítes concluídas hoje"
          value={`${doneToday} / ${totalToday}`}
        />
        <StatCard
          icon={Coffee}
          label="Suítes no café hoje"
          value={String(suitesToday)}
        />
        <StatCard
          icon={Wallet}
          label="Comissão do mês"
          value={`R$ ${totalCommissionMonth.toFixed(2)}`}
        />
        <Card>
          <CardContent className="flex items-start gap-4">
            <div className="size-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
              <AlertTriangle size={20} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Ocorrências Manutenção hoje</p>
              <p className="text-xl font-heading">{occurrencesToday ?? 0}</p>
              <div className="flex flex-col gap-0.5 mt-1">
                <Link href="/ocorrencias" className="text-xs text-primary hover:underline w-fit">
                  Ver detalhes
                </Link>
                <Link
                  href="/ocorrencias/historico"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 w-fit"
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
            <CardTitle className="font-heading text-lg">Suítes de hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(todayTasks ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>
                  Suíte {(t as unknown as { rooms: { number: string } }).rooms.number} ·{" "}
                  {TASK_TYPE_LABELS[t.task_type as ChecklistType]}
                </span>
                <Badge variant={t.status === "concluido" ? "default" : "secondary"}>
                  {t.status === "concluido" ? "Concluído" : t.status === "em_andamento" ? "Em andamento" : "Pendente"}
                </Badge>
              </div>
            ))}
            {(todayTasks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhuma suíte planejada para hoje.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Suítes de amanhã</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(tomorrowTasks ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>Suíte {(t as unknown as { rooms: { number: string } }).rooms.number}</span>
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
          <CardTitle className="font-heading text-lg">Serviços dos últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ServiceLogTable rows={serviceLogRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Totais do mês · {totalSuitesMonth} suítes · R$ {totalCommissionMonth.toFixed(2)} de comissão</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Consumo de frigobar · mês atual R$ {minibarSummary.currentMonth.total.toFixed(2)} · mês
            anterior R$ {minibarSummary.previousMonth.total.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2">Mês atual</p>
              <MinibarSummaryTable
                items={minibarSummary.currentMonth.items}
                total={minibarSummary.currentMonth.total}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Mês anterior</p>
              <MinibarSummaryTable
                items={minibarSummary.previousMonth.items}
                total={minibarSummary.previousMonth.total}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2 text-center">% de consumo no mês</p>
              <MinibarPieChart items={minibarSummary.currentMonth.items} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2 text-center">% de consumo desde o início</p>
              <MinibarPieChart items={minibarSummary.allTime.items} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Consumo de bar da piscina · mês atual R$ {poolbarSummary.currentMonth.total.toFixed(2)} · mês
            anterior R$ {poolbarSummary.previousMonth.total.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2">Mês atual</p>
              <MinibarSummaryTable
                items={poolbarSummary.currentMonth.items}
                total={poolbarSummary.currentMonth.total}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Mês anterior</p>
              <MinibarSummaryTable
                items={poolbarSummary.previousMonth.items}
                total={poolbarSummary.previousMonth.total}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2 text-center">% de consumo no mês</p>
              <MinibarPieChart items={poolbarSummary.currentMonth.items} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2 text-center">% de consumo desde o início</p>
              <MinibarPieChart items={poolbarSummary.allTime.items} />
            </div>
          </div>
        </CardContent>
      </Card>
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
      <CardContent className="flex items-start gap-4">
        <div className="size-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-heading truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

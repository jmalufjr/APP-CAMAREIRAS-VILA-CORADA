import { PageHeader } from "@/components/shared/page-header";
import { WeekMaintenanceTable } from "@/components/shared/week-maintenance-table";
import { getMaintenanceRangeRows, getWeeklyPlanningSummary } from "@/lib/actions/maintenance";
import { todayKey, mondayKey, fridayKey, monthsAgoKey, formatDateRangePt } from "@/lib/date";
import { PlanningFilters } from "./planning-filters";
import { WeeklyPlanningTable } from "./weekly-planning-table";

export default async function AdminManutencaoPreventivaPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from || monthsAgoKey(6);
  const to = sp.to || monthsAgoKey(-6);

  const weekStart = mondayKey(todayKey());
  const weekEnd = fridayKey(todayKey());

  const [weekRows, planningRows] = await Promise.all([
    getMaintenanceRangeRows(weekStart, weekEnd),
    getWeeklyPlanningSummary(from, to),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Trabalhos de manutenção preventiva por categoria e item."
      />

      <div className="space-y-3">
        <h2 className="font-heading text-lg text-primary">
          Pendentes, selecionadas e concluídas, esta semana
        </h2>
        <p className="text-sm text-muted-foreground">
          Semana de {formatDateRangePt(weekStart, weekEnd)} (segunda a sexta-feira).
        </p>
        <WeekMaintenanceTable rows={weekRows} />
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Planejamento semanal</h2>
        <PlanningFilters from={from} to={to} />
        <WeeklyPlanningTable rows={planningRows} />
      </div>
    </div>
  );
}

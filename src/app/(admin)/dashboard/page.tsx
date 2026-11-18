import { getCurrentProfile } from "@/lib/actions/session";
import { PageHeader } from "@/components/shared/page-header";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { todayKey, formatDatePt } from "@/lib/date";
import { getGerencialDashboard, getOperationalDashboard, type GerencialDashboard } from "@/lib/dashboard-data";
import { DashboardView } from "./dashboard-view";

// Resumo executivo: dois painéis (abas Operacional e Gerencial), para o administrador e para o gerente
// operacional.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const isGerente = profile.role === "gerente_operacional";

  const [operational, gerencial] = await Promise.all([
    getOperationalDashboard(),
    getGerencialDashboard().catch((): GerencialDashboard => EMPTY_GERENCIAL),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resumo executivo"
        subtitle={`Resumo de hoje, ${formatDatePt(todayKey())}`}
        action={isGerente ? undefined : <ThemeToggle />}
      />
      <DashboardView operational={operational} gerencial={gerencial} isGerente={isGerente} />
    </div>
  );
}

const EMPTY_GERENCIAL: GerencialDashboard = {
  month: todayKey().slice(0, 7),
  windowStart: "2026-11",
  windowMonths: 1,
  result: null,
  centersCurrent: [],
  centersAccum: [],
  expenseRanking: [],
  series: [],
  indicators: null,
  reviews: null,
};

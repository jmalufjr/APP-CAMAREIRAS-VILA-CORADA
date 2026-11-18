import { getCurrentProfile } from "@/lib/actions/session";
import { PageHeader } from "@/components/shared/page-header";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { todayKey, formatDatePt } from "@/lib/date";
import { getGerencialDashboard, getOperationalDashboard, type GerencialDashboard } from "@/lib/dashboard-data";
import { DashboardView } from "./dashboard-view";

// Resumo executivo: dois painéis (abas Operacional e Gerencial). O gerente operacional vê só o operacional.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const isGerente = profile.role === "gerente_operacional";

  const [operational, gerencial] = await Promise.all([
    getOperationalDashboard(),
    isGerente
      ? Promise.resolve<GerencialDashboard | null>(null)
      : getGerencialDashboard().catch((): GerencialDashboard | null => null),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resumo executivo"
        subtitle={`Resumo de hoje, ${formatDatePt(todayKey())}`}
        action={isGerente ? undefined : <ThemeToggle />}
      />
      <DashboardView operational={operational} gerencial={isGerente ? null : (gerencial ?? EMPTY_GERENCIAL)} />
    </div>
  );
}

const EMPTY_GERENCIAL: GerencialDashboard = {
  month: todayKey().slice(0, 7),
  result: null,
  centers: [],
  topExpenses: [],
  indicators: null,
  reviews: null,
};

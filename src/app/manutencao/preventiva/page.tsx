import { PageHeader } from "@/components/shared/page-header";
import { getManutencaoPreventivaOverview } from "@/lib/actions/maintenance";
import { getCurrentProfile } from "@/lib/actions/session";
import { WeeklyPlanningTable } from "@/components/shared/weekly-planning-table";
import { PreventivaWorkList } from "./preventiva-work-list";

export default async function ManutencaoPreventivaPage() {
  const [{ dueByCategory, nextFourWeeks }, profile] = await Promise.all([
    getManutencaoPreventivaOverview(),
    getCurrentProfile(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Trabalhos previstos para esta semana, por categoria."
      />
      <PreventivaWorkList categories={dueByCategory} currentUserId={profile.id} />

      <div className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Próximas quatro semanas</h2>
        <WeeklyPlanningTable rows={nextFourWeeks} />
      </div>
    </div>
  );
}

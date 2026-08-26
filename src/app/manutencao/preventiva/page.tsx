import { PageHeader } from "@/components/shared/page-header";
import { getManutencaoPreventivaOverview } from "@/lib/actions/maintenance";
import { getCurrentProfile } from "@/lib/actions/session";
import { PreventivaWorkList } from "./preventiva-work-list";
import { UpcomingMaintenanceTable } from "./upcoming-maintenance-table";

export default async function ManutencaoPreventivaPage() {
  const [{ dueByCategory, upcoming }, profile] = await Promise.all([
    getManutencaoPreventivaOverview(),
    getCurrentProfile(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Trabalhos previstos para hoje e amanhã, por categoria."
      />
      <PreventivaWorkList categories={dueByCategory} currentUserId={profile.id} />

      <div className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Próximos 30 dias</h2>
        <UpcomingMaintenanceTable items={upcoming} />
      </div>
    </div>
  );
}

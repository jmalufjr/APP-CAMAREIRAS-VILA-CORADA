import { PageHeader } from "@/components/shared/page-header";
import { getManutencaoOccurrences } from "@/lib/actions/occurrences";
import { getCurrentProfile } from "@/lib/actions/session";
import { OccurrenceWorkList } from "./occurrence-work-list";

export default async function ManutencaoOcorrenciasPage() {
  const [occurrences, profile] = await Promise.all([getManutencaoOccurrences(), getCurrentProfile()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ocorrências de Manutenção"
        subtitle="Ocorrências de hoje e de ontem registradas pelas camareiras, mais quaisquer ocorrências mais antigas ainda não resolvidas."
      />
      <OccurrenceWorkList occurrences={occurrences} currentUserId={profile.id} />
    </div>
  );
}

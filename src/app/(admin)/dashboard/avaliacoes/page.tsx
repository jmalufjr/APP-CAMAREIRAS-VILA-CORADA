import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getGuestReviews } from "@/lib/actions/stays-reviews";
import { ReviewsList } from "./reviews-list";

export default async function AvaliacoesPage() {
  const result = await getGuestReviews();

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/avaliacoes-hospedes" />
        <PageHeader title="Avaliações: conteúdo e resposta" subtitle="Todas as avaliações disponíveis na Stays." />
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/avaliacoes-hospedes" />
      <PageHeader
        title="Avaliações: conteúdo e resposta"
        subtitle={`${result.reviews.length} avaliações. Notas de 0 a 5 (as do Booking, que vêm de 0 a 10, foram divididas por 2). A lista é atualizada a cada sincronização com a Stays, manual ou automática. Clique em um canal para filtrar.`}
      />
      <ReviewsList reviews={result.reviews} />
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { getPurchaseList, getActiveDismissedSuggestions } from "@/lib/actions/purchase-list";
import { PurchaseListTable } from "./purchase-list-table";
import { DismissedSuggestionsSection } from "./dismissed-suggestions-section";

export default async function ListaComprasPage() {
  const [rows, dismissed] = await Promise.all([getPurchaseList(), getActiveDismissedSuggestions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lista de compras"
        subtitle="Mescla a sugestão calculada pelo sistema (giro de consumo × dias de folga do grupo) com o que a equipe informou visualmente estar faltando."
      />
      <PurchaseListTable rows={rows} />
      <DismissedSuggestionsSection rows={dismissed} />
    </div>
  );
}

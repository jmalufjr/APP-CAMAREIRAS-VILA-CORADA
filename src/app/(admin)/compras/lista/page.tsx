import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getPurchaseList } from "@/lib/actions/purchase-list";
import { PurchaseListTable } from "./purchase-list-table";

export default async function ListaComprasPage() {
  const rows = await getPurchaseList();

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Lista de compras"
        subtitle="Mescla a sugestão calculada pelo sistema (giro de consumo × dias de folga do grupo) com o que a equipe informou visualmente estar faltando."
      />
      <PurchaseListTable rows={rows} />
    </div>
  );
}

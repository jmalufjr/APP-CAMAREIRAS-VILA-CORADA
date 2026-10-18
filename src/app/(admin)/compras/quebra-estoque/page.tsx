import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getItemsAboveShrinkageThreshold } from "@/lib/actions/inventory-counts";
import { InventoryShrinkageTable } from "@/components/shared/inventory-shrinkage-table";

export default async function DashboardQuebraEstoquePage() {
  const rows = await getItemsAboveShrinkageThreshold();

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Quebra de estoque"
        subtitle="Itens cuja última contagem física ficou com quebra de estoque acima da quebra máxima admitida — ordenado do desvio mais grave pro menos grave."
      />
      <InventoryShrinkageTable rows={rows} />
    </div>
  );
}

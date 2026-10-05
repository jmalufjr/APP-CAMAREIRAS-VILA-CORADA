import { PageHeader } from "@/components/shared/page-header";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getCostItemOptions, getCostSubcenters } from "@/lib/actions/cost-plan";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";

export default async function ManutencaoComprasPage() {
  const [costItemOptions, costSubcenters, assetCategories, assetCatalogItems] = await Promise.all([
    getCostItemOptions(),
    getCostSubcenters(),
    getAssetCategories(),
    getFixedAssetCatalogItems(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Lançar compras e despesas" subtitle="Tire uma foto, escolha um arquivo (foto ou PDF) ou preencha manualmente." />
      <ExpenseForm
        costItemOptions={costItemOptions}
        costSubcenters={costSubcenters}
        assetCategories={assetCategories.filter((c) => c.active)}
        assetCatalogItems={assetCatalogItems}
      />
    </div>
  );
}

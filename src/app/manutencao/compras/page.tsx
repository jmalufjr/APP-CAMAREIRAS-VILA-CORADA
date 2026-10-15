import { PageHeader } from "@/components/shared/page-header";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getCostItemOptions, getCostCenters } from "@/lib/actions/cost-plan";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";

export default async function ManutencaoComprasPage() {
  const [costItemOptions, costCenters, assetCategories, assetCatalogItems] = await Promise.all([
    getCostItemOptions(),
    getCostCenters(),
    getAssetCategories(),
    getFixedAssetCatalogItems(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Lançar compras e despesas" subtitle="Tire uma foto, escolha um arquivo (foto ou PDF) ou preencha manualmente." />
      <ExpenseForm
        costItemOptions={costItemOptions}
        costCenters={costCenters}
        assetCategories={assetCategories.filter((c) => c.active)}
        assetCatalogItems={assetCatalogItems}
      />
    </div>
  );
}

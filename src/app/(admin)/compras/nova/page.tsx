import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getCostItemOptions, getCostCenters } from "@/lib/actions/cost-plan";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";
import { getSupplierOptions } from "@/lib/actions/suppliers";

export default async function NovaDespesaPage() {
  const [costItemOptions, costCenters, assetCategories, assetCatalogItems, supplierOptions] = await Promise.all([
    getCostItemOptions(),
    getCostCenters(),
    getAssetCategories(),
    getFixedAssetCatalogItems(),
    getSupplierOptions(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader title="Lançar compras e despesas" subtitle="Tire uma foto, escolha um arquivo (foto ou PDF) ou preencha manualmente." />
      <ExpenseForm
        costItemOptions={costItemOptions}
        costCenters={costCenters}
        assetCategories={assetCategories.filter((c) => c.active)}
        assetCatalogItems={assetCatalogItems}
        supplierOptions={supplierOptions}
      />
    </div>
  );
}

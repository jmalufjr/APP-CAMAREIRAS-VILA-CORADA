import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getCostItemOptions, getCostCenters } from "@/lib/actions/cost-plan";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";
import { getSupplierOptions } from "@/lib/actions/suppliers";
import { getProductCategories, getNonProductCostItems } from "@/lib/actions/products";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { getCurrentProfile } from "@/lib/actions/session";

export default async function NovaDespesaPage() {
  const [costItemOptions, costCenters, assetCategories, assetCatalogItems, supplierOptions] = await Promise.all([
    getCostItemOptions(),
    getCostCenters(),
    getAssetCategories(),
    getFixedAssetCatalogItems(),
    getSupplierOptions(),
  ]);

  const profile = await getCurrentProfile();
  const [categories, ledgerAccounts, candidates] = await Promise.all([getProductCategories(), getLedgerAccounts(), getNonProductCostItems()]);
  // Só o admin pode abrir o cadastro de produto dentro do lançamento.
  const catalog = profile.role === "admin" ? { categories: categories.filter((c) => c.active), ledgerAccounts, candidates } : null;

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader title="Lançar Compra" subtitle="Compra de produtos, itens de estoque ou bens. Tire uma foto, escolha um arquivo (foto ou PDF) ou preencha manualmente. Pra gastos como luz ou honorários, use “Lançar Despesa”." />
      <ExpenseForm
        costItemOptions={costItemOptions}
        costCenters={costCenters}
        assetCategories={assetCategories.filter((c) => c.active)}
        assetCatalogItems={assetCatalogItems}
        supplierOptions={supplierOptions}
        catalog={catalog}
      />
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getCostItemOptions, getCostCenters } from "@/lib/actions/cost-plan";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";
import { getSupplierOptions } from "@/lib/actions/suppliers";
import { getProductCategories, getNonProductCostItems } from "@/lib/actions/products";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { getExpenses } from "@/lib/actions/expenses";
import { daysAgoKey, todayKey } from "@/lib/date";

export default async function NovaDespesaPage() {
  const [costItemOptions, costCenters, assetCategories, assetCatalogItems, supplierOptions, recent] = await Promise.all([
    getCostItemOptions(),
    getCostCenters(),
    getAssetCategories(),
    getFixedAssetCatalogItems(),
    getSupplierOptions(),
    getExpenses(daysAgoKey(120), todayKey()),
  ]);

  const copyOptions = recent.slice(0, 30).map((e) => ({
    id: e.id,
    label: `${e.date.split("-").reverse().join("/")} · ${e.category_name} · R$ ${e.total_amount.toFixed(2)}`,
  }));

  const [categories, ledgerAccounts, candidates] = await Promise.all([getProductCategories(), getLedgerAccounts(), getNonProductCostItems()]);
  const catalog = { categories: categories.filter((c) => c.active), ledgerAccounts, candidates };

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Lançar Despesa"
        subtitle="Gasto que não é compra de produtos (conta de luz, honorários, serviços). Pra comprar produtos, use “Lançar Compra”."
      />
      <ExpenseForm
        kind="despesa"
        copyOptions={copyOptions}
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

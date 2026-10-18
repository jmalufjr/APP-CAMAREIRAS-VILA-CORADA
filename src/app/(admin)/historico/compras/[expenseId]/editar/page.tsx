import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getExpenseWithItems } from "@/lib/actions/expenses";
import { getCostItemOptions, getCostCenters } from "@/lib/actions/cost-plan";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";
import { getSupplierOptions } from "@/lib/actions/suppliers";
import { getProductCategories, getNonProductCostItems } from "@/lib/actions/products";
import { getLedgerAccounts } from "@/lib/actions/ledger";

export default async function EditarDespesaPage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await params;
  const [expense, costItemOptions, costCenters, assetCategories, assetCatalogItems, supplierOptions] = await Promise.all([
    getExpenseWithItems(expenseId),
    getCostItemOptions(),
    getCostCenters(),
    getAssetCategories(),
    getFixedAssetCatalogItems(),
    getSupplierOptions(),
  ]);

  if (!expense) notFound();

  // Despesa = um gasto único numa categoria que não é produto/estoque, sem
  // ajustes de linha e sem ativo permanente; qualquer outro lançamento
  // (vários itens, produto, ativo, desconto/frete/tributo) edita-se como compra.
  const optionById = new Map(costItemOptions.map((c) => [c.id, c]));
  const only = expense.items[0];
  const isDespesa =
    expense.items.length === 0 ||
    (expense.items.length === 1 &&
      !only.fixed_asset_id &&
      !!only.cost_item_id &&
      !optionById.get(only.cost_item_id)?.is_product &&
      only.discount === 0 &&
      only.freight_and_other_costs === 0 &&
      only.recoverable_tax === 0 &&
      only.non_recoverable_tax === 0);

  const [categories, ledgerAccounts, candidates] = await Promise.all([getProductCategories(), getLedgerAccounts(), getNonProductCostItems()]);
  const catalog = { categories: categories.filter((c) => c.active), ledgerAccounts, candidates };

  return (
    <div className="space-y-6">
      <BackLink href="/historico" />
      <PageHeader title={isDespesa ? "Editar despesa" : "Editar compra"} subtitle="Corrija os dados já lançados — a entrada de estoque, quando houver, é refeita automaticamente." />
      <ExpenseForm
        kind={isDespesa ? "despesa" : "compra"}
        mode="edit"
        expenseId={expense.id}
        initial={expense}
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

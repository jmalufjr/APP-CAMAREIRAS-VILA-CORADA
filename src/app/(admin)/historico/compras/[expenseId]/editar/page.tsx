import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getExpenseWithItems } from "@/lib/actions/expenses";
import { getCostItemOptions, getCostSubcenters } from "@/lib/actions/cost-plan";
import { getAssetCategories, getFixedAssetCatalogItems } from "@/lib/actions/fixed-assets";

export default async function EditarDespesaPage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await params;
  const [expense, costItemOptions, costSubcenters, assetCategories, assetCatalogItems] = await Promise.all([
    getExpenseWithItems(expenseId),
    getCostItemOptions(),
    getCostSubcenters(),
    getAssetCategories(),
    getFixedAssetCatalogItems(),
  ]);

  if (!expense) notFound();

  return (
    <div className="space-y-6">
      <BackLink href="/historico" />
      <PageHeader title="Editar despesa" subtitle="Corrija os dados já lançados — a entrada de estoque é refeita automaticamente." />
      <ExpenseForm
        mode="edit"
        expenseId={expense.id}
        initial={expense}
        costItemOptions={costItemOptions}
        costSubcenters={costSubcenters}
        assetCategories={assetCategories.filter((c) => c.active)}
        assetCatalogItems={assetCatalogItems}
      />
    </div>
  );
}

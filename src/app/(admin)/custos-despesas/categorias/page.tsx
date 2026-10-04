import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { ExpenseCategoriesPanel } from "./expense-categories-panel";

export default async function CategoriasDeGastoPage() {
  const categories = await getExpenseCategories();

  return (
    <div className="space-y-6">
      <BackLink href="/custos-despesas" />
      <PageHeader
        title="Categorias de gasto"
        subtitle="Gerencie as categorias de compras e despesas da pousada, e como cada uma entra no cálculo de custos."
      />
      <ExpenseCategoriesPanel categories={categories} />
    </div>
  );
}

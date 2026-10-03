import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { ExpenseCategoriesPanel } from "./expense-categories-panel";

export default async function CategoriasDespesaPage() {
  const categories = await getExpenseCategories();

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader title="Categorias de gasto" subtitle="Gerencie as categorias de compras e despesas da pousada." />
      <ExpenseCategoriesPanel categories={categories} />
    </div>
  );
}

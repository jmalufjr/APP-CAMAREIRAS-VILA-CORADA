import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { getInventoryItems } from "@/lib/actions/inventory-items";

export default async function NovaDespesaPage() {
  const [categories, inventoryItems] = await Promise.all([getExpenseCategories(), getInventoryItems(true)]);

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader title="Lançar compra/despesa" subtitle="Tire uma foto da nota ou preencha manualmente." />
      <ExpenseForm categories={categories.filter((c) => c.active)} inventoryItems={inventoryItems} />
    </div>
  );
}

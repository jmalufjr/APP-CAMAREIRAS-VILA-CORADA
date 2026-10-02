import { PageHeader } from "@/components/shared/page-header";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { getInventoryItems } from "@/lib/actions/inventory-items";
import { getInventoryTurnoverGroups } from "@/lib/actions/inventory-turnover-groups";

export default async function ManutencaoComprasPage() {
  const [categories, inventoryItems, turnoverGroups] = await Promise.all([
    getExpenseCategories(),
    getInventoryItems(true),
    getInventoryTurnoverGroups(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Lançar Compra" subtitle="Tire uma foto, escolha um arquivo (foto ou PDF) ou preencha manualmente." />
      <ExpenseForm
        categories={categories.filter((c) => c.active)}
        inventoryItems={inventoryItems}
        turnoverGroups={turnoverGroups}
      />
    </div>
  );
}

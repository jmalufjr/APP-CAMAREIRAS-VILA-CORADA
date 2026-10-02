import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getExpenseWithItems } from "@/lib/actions/expenses";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { getInventoryItems } from "@/lib/actions/inventory-items";
import { getInventoryTurnoverGroups } from "@/lib/actions/inventory-turnover-groups";

export default async function EditarDespesaPage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await params;
  const [expense, categories, inventoryItems, turnoverGroups] = await Promise.all([
    getExpenseWithItems(expenseId),
    getExpenseCategories(),
    getInventoryItems(true),
    getInventoryTurnoverGroups(),
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
        categories={categories.filter((c) => c.active)}
        inventoryItems={inventoryItems}
        turnoverGroups={turnoverGroups}
      />
    </div>
  );
}

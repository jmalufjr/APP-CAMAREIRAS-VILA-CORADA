import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ExpenseForm } from "@/components/shared/expense-form";
import { getExpenseWithItems } from "@/lib/actions/expenses";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { getInventoryItems } from "@/lib/actions/inventory-items";

export default async function EditarDespesaPage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await params;
  const [expense, categories, inventoryItems] = await Promise.all([
    getExpenseWithItems(expenseId),
    getExpenseCategories(),
    getInventoryItems(true),
  ]);

  if (!expense) notFound();

  return (
    <div className="space-y-6">
      <BackLink href="/compras/historico" />
      <PageHeader title="Editar despesa" subtitle="Corrija os dados já lançados — a entrada de estoque é refeita automaticamente." />
      <ExpenseForm
        mode="edit"
        expenseId={expense.id}
        initial={expense}
        categories={categories.filter((c) => c.active)}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}

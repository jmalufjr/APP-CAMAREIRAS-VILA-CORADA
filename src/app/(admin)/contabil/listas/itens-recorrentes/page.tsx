import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpenseCategories, getRecurringExpenses } from "@/lib/actions/expense-model";
import { RecurringPanel } from "./recurring-panel";

export default async function ItensRecorrentesPage() {
  const [items, categories] = await Promise.all([getRecurringExpenses(), getExpenseCategories()]);
  return (
    <div className="space-y-6">
      <BackLink href="/contabil/listas" />
      <PageHeader
        title="Itens recorrentes"
        subtitle="Despesas que se repetem todo mês (salários, honorários, internet etc.). Todo mês o sistema cria o lançamento no dia combinado (a verificação roda todo dia de manhã), e você só ajusta o valor quando mudar. Quando a nota real do mês chega, ela substitui o lançamento automático."
      />
      <RecurringPanel items={items} categories={categories.filter((c) => c.active)} />
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpenses, getExpenseSummaryByCategory, getExpenseSummaryBySupplier } from "@/lib/actions/expenses";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { ComprasHistoricoFilters } from "@/components/shared/compras-historico-filters";
import { ComprasHistoryTable } from "@/components/shared/compras-history-table";
import { ExpenseSummaryCards } from "@/components/shared/expense-summary-cards";
import { toDateKey, nowInBrazil } from "@/lib/date";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}

export default async function ManutencaoComprasHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;
  const categoryId = sp.category || "";

  const [rows, byCategory, bySupplier, categories] = await Promise.all([
    getExpenses(from, to, categoryId || undefined),
    getExpenseSummaryByCategory(from, to),
    getExpenseSummaryBySupplier(from, to),
    getExpenseCategories(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/manutencao/compras" />
      <PageHeader title="Histórico de compras" subtitle="Dados do período selecionado." />
      <ComprasHistoricoFilters
        from={from}
        to={to}
        categoryId={categoryId || "todas"}
        categories={categories}
        basePath="/manutencao/compras/historico"
      />

      <ExpenseSummaryCards byCategory={byCategory} bySupplier={bySupplier} />

      <ComprasHistoryTable rows={rows} canManage={false} />
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getExpenses, getExpenseSummaryByCategory } from "@/lib/actions/expenses";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { ComprasHistoricoFilters } from "@/components/shared/compras-historico-filters";
import { ComprasHistoryTable } from "@/components/shared/compras-history-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const [rows, summary, categories] = await Promise.all([
    getExpenses(from, to, categoryId || undefined),
    getExpenseSummaryByCategory(from, to),
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

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Total por categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {summary.map((s) => (
            <div key={s.category_id} className="flex justify-between text-sm">
              <span>{s.category_name}</span>
              <span className="font-medium">R$ {s.total.toFixed(2)}</span>
            </div>
          ))}
          {summary.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>}
        </CardContent>
      </Card>

      <ComprasHistoryTable rows={rows} canDelete={false} />
    </div>
  );
}

import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { getPoolbarConsumptionForPeriod } from "@/lib/actions/poolbar";
import { getMinibarConsumptionForPeriod } from "@/lib/actions/minibar";
import { getReceiptsByPaymentMethodForPeriod } from "@/lib/actions/room-bills";
import { getCostCentersSummaryForPeriod, getBarFrigobarCmvForPeriod, getBreakfastCostForPeriod } from "@/lib/actions/cost-accounting";
import { getInventoryStockReport } from "@/lib/actions/inventory-report";
import { toDateKey, nowInBrazil } from "@/lib/date";
import { ExportacoesPanel } from "./exportacoes-panel";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}

// Exportações pro sistema financeiro (PRD_compras&contabil.md seção
// 22.1 item 8.2, Módulo Contábil Leva 7) — só a parte de arquivo
// (CSV, sempre abre certo no Excel) por ora; a API de verdade entre os
// dois sistemas fica pra depois (decisão 22.3 item 13).
export default async function ExportacoesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;

  const [poolbar, minibar, receiptsByMethod, costSummary, cmv, breakfast, stock] = await Promise.all([
    getPoolbarConsumptionForPeriod(from, to),
    getMinibarConsumptionForPeriod(from, to),
    getReceiptsByPaymentMethodForPeriod(from, to),
    getCostCentersSummaryForPeriod(from, to),
    getBarFrigobarCmvForPeriod(from, to),
    getBreakfastCostForPeriod(from, to),
    getInventoryStockReport(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Exportações para o sistema financeiro"
        subtitle="Arquivos CSV, por período, com os dados que o sistema financeiro precisa — receitas, recebimentos, custos, estoque, CMV e café da manhã. Abrem direto no Excel. A integração por API direta entre os dois sistemas ainda não existe."
      />
      <DateRangeFilter basePath="/contabil/exportacoes" from={from} to={to} />
      <ExportacoesPanel
        from={from}
        to={to}
        poolbar={poolbar}
        minibar={minibar}
        receiptsByMethod={receiptsByMethod}
        costSummary={costSummary}
        cmv={cmv}
        breakfast={breakfast}
        stock={stock}
      />
    </div>
  );
}

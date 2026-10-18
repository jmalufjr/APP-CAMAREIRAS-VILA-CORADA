import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ReportFilters, ReportView } from "@/components/shared/report-view";
import { toDateKey, nowInBrazil } from "@/lib/date";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}
import { getBalanceteAnalitico, type Granularity } from "@/lib/actions/ledger-reports";

export default async function BalanceteAnaliticoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; g?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;
  const g: Granularity = sp.g === "mes" || sp.g === "ano" ? sp.g : "dia";

  const data = await getBalanceteAnalitico(from, to, g);
  const columns = ["Período", "Grupo", "Conta", "Item (produto/despesa)", "Débitos", "Créditos", "Saldo acumulado"];
  const rows = data.map((r) => [r.period, r.group, r.account, r.item, r.debits, r.credits, r.balance]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/demonstrativos" />
      <PageHeader
        title="Balancete analítico"
        subtitle="Saldo de cada conta do plano de contas detalhado pelos itens lançados nela (produtos e despesas), na mesma divisão do Plano de contas e centros de custos. O saldo é acumulado até o fim de cada período."
      />
      <ReportFilters
        basePath="/contabil/demonstrativos/balancete-analitico"
        fields={[
          { name: "from", label: "De", type: "date", value: from },
          { name: "to", label: "Até", type: "date", value: to },
          {
            name: "g",
            label: "Periodicidade",
            type: "select",
            value: g,
            options: [
              { value: "dia", label: "Diária" },
              { value: "mes", label: "Mensal" },
              { value: "ano", label: "Anual" },
            ],
          },
        ]}
      />
      <ReportView
        title="Balancete analítico"
        subtitle={`Período: ${from} a ${to} · periodicidade ${g === "dia" ? "diária" : g === "mes" ? "mensal" : "anual"}`}
        filenameBase={`balancete-analitico-${from}-a-${to}`}
        columns={columns}
        rows={rows}
        numericColumns={[4, 5, 6]}
      />
    </div>
  );
}

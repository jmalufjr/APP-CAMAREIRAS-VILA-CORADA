import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ReportFilters, ReportView } from "@/components/shared/report-view";
import { toDateKey, nowInBrazil } from "@/lib/date";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}
import { getLivroRazao } from "@/lib/actions/ledger-reports";
import { getLedgerAccounts } from "@/lib/actions/ledger";

export default async function LivroRazaoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; conta?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;
  const conta = sp.conta && sp.conta !== "todas" ? sp.conta : undefined;

  const [data, accounts] = await Promise.all([getLivroRazao(from, to, conta), getLedgerAccounts()]);
  const rows = data.map((r) => [r.account, r.date, r.description, r.center, r.debit, r.credit, r.balance]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/demonstrativos" />
      <PageHeader
        title="Livro Razão"
        subtitle="Os lançamentos de cada conta do plano de contas, com débitos, créditos e o saldo corrente. Cada conta abre com o saldo anterior ao período."
      />
      <ReportFilters
        basePath="/contabil/demonstrativos/livro-razao"
        fields={[
          { name: "from", label: "De", type: "date", value: from },
          { name: "to", label: "Até", type: "date", value: to },
          {
            name: "conta",
            label: "Conta",
            type: "select",
            value: conta ?? "todas",
            options: [
              { value: "todas", label: "Todas as contas" },
              ...accounts.map((a) => ({ value: a.code, label: `${a.display_code ? a.display_code + " — " : ""}${a.name}` })),
            ],
          },
        ]}
      />
      <ReportView
        title="Livro Razão"
        subtitle={`Período: ${from} a ${to}`}
        filenameBase={`livro-razao-${from}-a-${to}`}
        columns={["Conta", "Data", "Histórico", "Centro de custo", "Débito", "Crédito", "Saldo"]}
        rows={rows}
        numericColumns={[4, 5, 6]}
      />
    </div>
  );
}

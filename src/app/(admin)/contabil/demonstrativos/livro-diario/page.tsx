import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { getLedgerEntries } from "@/lib/actions/ledger";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { getCostCenters } from "@/lib/actions/cost-plan";
import { toDateKey, nowInBrazil } from "@/lib/date";
import { LedgerEntriesPanel } from "./ledger-entries-panel";
import { ReportView } from "@/components/shared/report-view";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}

export default async function LivroDeLancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;

  const [entries, accounts, costCenters] = await Promise.all([
    getLedgerEntries(from, to),
    getLedgerAccounts(),
    getCostCenters(),
  ]);

  const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sideText = (lines: { account_name: string; cost_center_name: string | null; direction: string; amount: number }[], dir: string) =>
    lines
      .filter((l) => l.direction === dir)
      .map((l) => `${l.account_name}${l.cost_center_name ? " (" + l.cost_center_name + ")" : ""}: R$ ${money(l.amount)}`)
      .join(" | ");
  const diarioRows = [...entries]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at))
    .map((e) => [
      e.entry_date.split("-").reverse().join("/"),
      e.description + (e.status === "estornado" ? " [estornado]" : ""),
      sideText(e.lines, "debito"),
      sideText(e.lines, "credito"),
      e.lines.filter((l) => l.direction === "debito").reduce((s, l) => s + l.amount, 0),
    ]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/demonstrativos" />
      <PageHeader
        title="Livro Diário"
        subtitle="Todo lançamento confirmado gera débitos e créditos que sempre se equilibram. Um lançamento nunca é apagado — só estornado, o que cria um novo lançamento espelhado."
      />
      <DateRangeFilter basePath="/contabil/demonstrativos/livro-diario" from={from} to={to} />
      <ReportView
        title="Livro Diário"
        subtitle={`Período: ${from} a ${to} — todos os fatos contábeis em ordem cronológica`}
        filenameBase={`livro-diario-${from}-a-${to}`}
        columns={["Data", "Histórico", "Contas debitadas", "Contas creditadas", "Valor (R$)"]}
        rows={diarioRows}
        numericColumns={[4]}
      />
      <h3 className="font-heading text-lg pt-4">Lançamentos detalhados, lançamento manual e estornos</h3>
      <LedgerEntriesPanel entries={entries} accounts={accounts.filter((a) => a.active)} costCenters={costCenters.filter((c) => c.active)} />
    </div>
  );
}

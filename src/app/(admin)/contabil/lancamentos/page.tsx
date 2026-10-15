import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { getLedgerEntries } from "@/lib/actions/ledger";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { getCostCenters } from "@/lib/actions/cost-plan";
import { toDateKey, nowInBrazil } from "@/lib/date";
import { LedgerEntriesPanel } from "./ledger-entries-panel";

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

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Livro de lançamentos"
        subtitle="Todo lançamento confirmado gera débitos e créditos que sempre se equilibram. Um lançamento nunca é apagado — só estornado, o que cria um novo lançamento espelhado."
      />
      <DateRangeFilter basePath="/contabil/lancamentos" from={from} to={to} />
      <LedgerEntriesPanel entries={entries} accounts={accounts.filter((a) => a.active)} costCenters={costCenters.filter((c) => c.active)} />
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { getCostCenters } from "@/lib/actions/cost-plan";
import { LedgerAccountsPanel } from "./ledger-accounts-panel";
import { CostCentersPanel } from "./cost-centers-panel";

export default async function PlanoDeContasContabilPage() {
  const [accounts, centers] = await Promise.all([getLedgerAccounts(), getCostCenters()]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Plano de contas e centros de custos"
        subtitle="Primeiro as contas contábeis (Ativo, Passivo, Receita, Custo, Despesa) usadas nos lançamentos — dizem QUE TIPO de movimento é; no final, os centros de custo, que dizem DE QUE PARTE da pousada é um gasto."
      />
      <LedgerAccountsPanel accounts={accounts} />
      <CostCentersPanel centers={centers} />
    </div>
  );
}

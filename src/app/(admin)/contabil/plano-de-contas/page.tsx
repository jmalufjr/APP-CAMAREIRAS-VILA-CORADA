import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { LedgerAccountsPanel } from "./ledger-accounts-panel";

export default async function PlanoDeContasContabilPage() {
  const accounts = await getLedgerAccounts();

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Plano de contas"
        subtitle="As contas contábeis (Ativo, Passivo, Receita, Custo, Despesa) usadas nos lançamentos — diferente do Plano de Contas de centros de custo (em Listas), que diz DE QUE PARTE da pousada é um gasto; aqui se diz QUE TIPO de movimento é."
      />
      <LedgerAccountsPanel accounts={accounts} />
    </div>
  );
}

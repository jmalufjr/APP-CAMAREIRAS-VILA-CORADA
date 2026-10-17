import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getCostCenters, getCostItems } from "@/lib/actions/cost-plan";
import { getLedgerAccounts } from "@/lib/actions/ledger";
import { NonProductCostItems } from "./cost-item-dialog";

export default async function CadastroDeDespesasPage() {
  const [centers, ledgerAccounts, allCostItems] = await Promise.all([getCostCenters(), getLedgerAccounts(), getCostItems()]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/listas" />
      <PageHeader
        title="Cadastro de despesas"
        subtitle="Categorias de gasto que não são produtos nem têm estoque (salário, luz, honorários, impostos…): centros de custo com percentual e conta contábil. São as categorias usadas em “Lançar Despesa”."
      />
      <NonProductCostItems
        items={allCostItems.filter((i) => !i.is_product)}
        centers={centers}
        ledgerAccounts={ledgerAccounts}
      />
    </div>
  );
}

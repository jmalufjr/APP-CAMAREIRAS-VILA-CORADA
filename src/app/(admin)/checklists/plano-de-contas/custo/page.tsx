import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getCostItems, getCostCenters } from "@/lib/actions/cost-plan";
import { getInventoryItems } from "@/lib/actions/inventory-items";
import { CostPlanPanel } from "./cost-plan-panel";

export default async function PlanoDeItensDeCustoPage() {
  const [items, centers, inventoryItems] = await Promise.all([
    getCostItems(),
    getCostCenters(),
    getInventoryItems(false),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/checklists/plano-de-contas" />
      <PageHeader
        title="Plano de itens de custo"
        subtitle="Itens de custo (os mais analíticos), ligados direto a 1 ou mais centros de custo. Quando um item se liga a mais de 1 centro, os percentuais precisam somar 100%."
      />
      <CostPlanPanel items={items} centers={centers} inventoryItems={inventoryItems} />
    </div>
  );
}

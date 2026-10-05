import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getCostItems, getCostSubcenters, getCostCenters } from "@/lib/actions/cost-plan";
import { getInventoryItems } from "@/lib/actions/inventory-items";
import { CostPlanPanel } from "./cost-plan-panel";

export default async function PlanoDeItensDeCustoPage() {
  const [items, subcenters, centers, inventoryItems] = await Promise.all([
    getCostItems(),
    getCostSubcenters(),
    getCostCenters(),
    getInventoryItems(false),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/checklists/plano-de-contas" />
      <PageHeader
        title="Plano de itens de custo"
        subtitle="Itens de custo (os mais analíticos), ligados a 1 ou mais subcentros; subcentros, ligados a 1 ou mais centros. Quando um item/subcentro se liga a mais de 1, os percentuais precisam somar 100%."
      />
      <CostPlanPanel items={items} subcenters={subcenters} centers={centers} inventoryItems={inventoryItems} />
    </div>
  );
}

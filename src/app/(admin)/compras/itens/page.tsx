import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getInventoryItemsWithCostPlan } from "@/lib/actions/inventory-cost-view";
import { InventoryItemsPanel } from "./inventory-items-panel";

export default async function ItensEstoquePage() {
  const items = await getInventoryItemsWithCostPlan();

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Itens de estoque e ciclo de compras"
        subtitle="Lista somente leitura — vem do Plano de Contas (Listas → Plano de Contas → Itens de custo). Só os dias de folga são editáveis aqui."
      />
      <InventoryItemsPanel items={items} />
    </div>
  );
}

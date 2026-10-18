import { PageHeader } from "@/components/shared/page-header";
import { PurchaseRequestsPanel } from "@/components/shared/purchase-requests-panel";
import { getInventoryItems } from "@/lib/actions/inventory-items";
import { getMyPurchaseRequests } from "@/lib/actions/purchase-requests";

export default async function PedidosCompraPage() {
  const [items, myRequests] = await Promise.all([getInventoryItems(true), getMyPurchaseRequests()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos de compra"
        subtitle="Viu algo acabando (ex.: frutas do café da manhã)? Registre aqui pra o admin saber."
      />
      <PurchaseRequestsPanel items={items} myRequests={myRequests} />
    </div>
  );
}

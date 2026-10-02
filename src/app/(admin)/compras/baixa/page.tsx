import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { StockWithdrawalPanel } from "@/components/shared/stock-withdrawal-panel";
import { getInventoryItems } from "@/lib/actions/inventory-items";

export default async function BaixaEstoquePage() {
  const items = await getInventoryItems(true);

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader title="Baixa de estoque" subtitle="Busque o item pelo nome ou pelo código de barras." />
      <StockWithdrawalPanel items={items} />
    </div>
  );
}

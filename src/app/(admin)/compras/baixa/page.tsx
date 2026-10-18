import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { StockWithdrawalPanel } from "@/components/shared/stock-withdrawal-panel";
import { getInventoryItems } from "@/lib/actions/inventory-items";
import { getCurrentProfile } from "@/lib/actions/session";

export default async function BaixaEstoquePage() {
  const [items, profile] = await Promise.all([getInventoryItems(true), getCurrentProfile()]);

  return (
    <div className="space-y-6">
      <BackLink href={profile.role === "gerente_operacional" ? "/contabil" : "/compras"} />
      <PageHeader title="Baixa de estoque" subtitle="Busque o item pelo nome ou pelo código de barras." />
      <StockWithdrawalPanel items={items} />
    </div>
  );
}

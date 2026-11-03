import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getPurchasesReport } from "@/lib/actions/purchases-report";
import { getSupplierOptions } from "@/lib/actions/suppliers";
import { getCostItemOptions } from "@/lib/actions/cost-plan";
import { PurchasesReportEditor } from "./purchases-report-editor";

export default async function RelatorioComprasPage() {
  const [rows, suppliers, costItems] = await Promise.all([getPurchasesReport(), getSupplierOptions(), getCostItemOptions()]);
  const products = costItems.filter((c) => c.is_product).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Relatório de compras"
        subtitle="Compras dos últimos 30 dias, como estão registradas no sistema. Você pode corrigir qualquer campo e clicar em Salvar."
      />
      <PurchasesReportEditor rows={rows} suppliers={suppliers} products={products} />
    </div>
  );
}

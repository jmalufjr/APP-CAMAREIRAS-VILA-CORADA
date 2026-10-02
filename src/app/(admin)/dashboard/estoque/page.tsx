import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getInventoryStockReport, getTopPurchasedItems } from "@/lib/actions/inventory-report";
import { TopPurchasedChart } from "./top-purchased-chart";
import { InventoryStockTable } from "./inventory-stock-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function DashboardEstoquePage() {
  const [report, topMonth, topAllTime] = await Promise.all([
    getInventoryStockReport(),
    getTopPurchasedItems("month"),
    getTopPurchasedItems("all"),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Estoque"
        subtitle="Compras do mês, saldo e previsão de dias restantes, por item de estoque."
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">20 itens mais comprados no mês (por valor)</CardTitle>
          </CardHeader>
          <CardContent>
            <TopPurchasedChart data={topMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">20 itens mais comprados desde sempre (por valor)</CardTitle>
          </CardHeader>
          <CardContent>
            <TopPurchasedChart data={topAllTime} />
          </CardContent>
        </Card>
      </div>

      <InventoryStockTable rows={report} />
    </div>
  );
}

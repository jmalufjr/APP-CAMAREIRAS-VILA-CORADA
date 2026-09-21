import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MinibarPieChart } from "../minibar-pie-chart";
import { MinibarSummaryTable } from "@/components/shared/minibar-summary-table";
import { getMinibarMonthlySummary } from "@/lib/actions/minibar";

export default async function ConsumoFrigobarPage() {
  const minibarSummary = await getMinibarMonthlySummary();

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Consumo de frigobar"
        subtitle="Totais do mês atual e do mês anterior, e a participação de cada item."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Consumo de frigobar · mês atual R$ {minibarSummary.currentMonth.total.toFixed(2)} · mês
            anterior R$ {minibarSummary.previousMonth.total.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2">Mês atual</p>
              <MinibarSummaryTable
                items={minibarSummary.currentMonth.items}
                total={minibarSummary.currentMonth.total}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Mês anterior</p>
              <MinibarSummaryTable
                items={minibarSummary.previousMonth.items}
                total={minibarSummary.previousMonth.total}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2 text-center">% de consumo no mês</p>
              <MinibarPieChart items={minibarSummary.currentMonth.items} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2 text-center">% de consumo desde o início</p>
              <MinibarPieChart items={minibarSummary.allTime.items} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

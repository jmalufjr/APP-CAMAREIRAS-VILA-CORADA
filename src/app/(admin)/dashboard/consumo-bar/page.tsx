import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MinibarPieChart } from "../minibar-pie-chart";
import { MinibarSummaryTable } from "@/components/shared/minibar-summary-table";
import { MinibarPercentTable } from "@/components/shared/minibar-percent-table";
import { getPoolbarMonthlySummary, type PoolbarCategorySummary } from "@/lib/actions/poolbar";

function CategorySection({
  title,
  currentMonth,
  previousMonth,
  allTime,
}: {
  title: string;
  currentMonth: PoolbarCategorySummary;
  previousMonth: PoolbarCategorySummary;
  allTime: PoolbarCategorySummary;
}) {
  return (
    <div className="space-y-4">
      <p className="font-heading text-base">
        {title} · mês atual R$ {currentMonth.total.toFixed(2)} · mês anterior R$ {previousMonth.total.toFixed(2)}
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-medium mb-2">Mês atual</p>
          <MinibarSummaryTable items={currentMonth.items} total={currentMonth.total} />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Mês anterior</p>
          <MinibarSummaryTable items={previousMonth.items} total={previousMonth.total} />
        </div>
      </div>
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2 text-center">Consumo no mês (valor)</p>
            <MinibarPieChart items={currentMonth.items} valueKey="total" />
          </div>
          <div>
            <p className="text-sm font-medium mb-2 text-center">Consumo no mês (quantidade)</p>
            <MinibarPieChart items={currentMonth.items} valueKey="quantity" />
          </div>
        </div>
        <MinibarPercentTable items={currentMonth.items} />
      </div>
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2 text-center">Consumo desde o início (valor)</p>
            <MinibarPieChart items={allTime.items} valueKey="total" />
          </div>
          <div>
            <p className="text-sm font-medium mb-2 text-center">Consumo desde o início (quantidade)</p>
            <MinibarPieChart items={allTime.items} valueKey="quantity" />
          </div>
        </div>
        <MinibarPercentTable items={allTime.items} />
      </div>
    </div>
  );
}

export default async function ConsumoBarPage() {
  const poolbarSummary = await getPoolbarMonthlySummary();

  const currentMonthTotal = poolbarSummary.currentMonth.petiscos.total + poolbarSummary.currentMonth.bebidas.total;
  const previousMonthTotal = poolbarSummary.previousMonth.petiscos.total + poolbarSummary.previousMonth.bebidas.total;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Consumo de bar"
        subtitle="Petiscos e bebidas contabilizados separadamente, mês atual e mês anterior."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Consumo de bar da piscina · mês atual R$ {currentMonthTotal.toFixed(2)} · mês anterior R${" "}
            {previousMonthTotal.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <CategorySection
            title="Petiscos"
            currentMonth={poolbarSummary.currentMonth.petiscos}
            previousMonth={poolbarSummary.previousMonth.petiscos}
            allTime={poolbarSummary.allTime.petiscos}
          />
          <div className="border-t border-border pt-8">
            <CategorySection
              title="Bebidas"
              currentMonth={poolbarSummary.currentMonth.bebidas}
              previousMonth={poolbarSummary.previousMonth.bebidas}
              allTime={poolbarSummary.allTime.bebidas}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

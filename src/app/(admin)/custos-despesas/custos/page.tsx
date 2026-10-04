import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  getCostCentersSummaryForPeriod,
  getBreakfastCostForPeriod,
  getDishCostsForPeriod,
} from "@/lib/actions/cost-accounting";
import { COST_CENTER_LABELS } from "@/lib/cost-accounting";
import { toDateKey, nowInBrazil } from "@/lib/date";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}

function fmt(v: number): string {
  return `R$ ${v.toFixed(2)}`;
}

export default async function CustosPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;

  const [summary, breakfast, dishes] = await Promise.all([
    getCostCentersSummaryForPeriod(from, to),
    getBreakfastCostForPeriod(from, to),
    getDishCostsForPeriod(from, to),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/custos-despesas" />
      <PageHeader
        title="Custos"
        subtitle="Custo da hospedagem (já incluindo o café da manhã, embutido na diária), do café da manhã em detalhe, e de cada prato/produto do bar e do frigobar."
      />
      <DateRangeFilter basePath="/custos-despesas/custos" from={from} to={to} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["hospedagem", "cafe_manha", "servico_bar", "frigobar"] as const).map((center) => (
          <Card key={center}>
            <CardHeader>
              <CardTitle className="font-heading text-base">{COST_CENTER_LABELS[center]}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-medium">{fmt(summary.totals[center])}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        &quot;Hospedagem&quot; já soma o custo do Café da manhã por dentro — o café não é cobrado à parte do hóspede,
        então seu custo faz parte do custo da diária. O card &quot;Café da manhã&quot; mostra esse mesmo valor
        separado, só pra referência.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Custo médio por diária ocupada · {summary.occupiedRoomNights} diária(s) ocupada(s) no período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-medium">
            {summary.costPerOccupiedNight !== null ? fmt(summary.costPerOccupiedNight) : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Rateio dos custos fixos, por categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Gasto total</TableHead>
                  <TableHead>Hospedagem</TableHead>
                  <TableHead>Café da manhã</TableHead>
                  <TableHead>Serviço de bar</TableHead>
                  <TableHead>Frigobar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.breakdown.map((row) => (
                  <TableRow key={row.category_id}>
                    <TableCell>{row.category_name}</TableCell>
                    <TableCell>{fmt(row.total_spend)}</TableCell>
                    <TableCell>{fmt(row.allocation.hospedagem)}</TableCell>
                    <TableCell>{fmt(row.allocation.cafe_manha)}</TableCell>
                    <TableCell>{fmt(row.allocation.servico_bar)}</TableCell>
                    <TableCell>{fmt(row.allocation.frigobar)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Café da manhã · {breakfast.guestNights} hóspede(s)-noite ·{" "}
            {breakfast.costPerGuest !== null ? `${fmt(breakfast.costPerGuest)} por hóspede` : "sem hóspede no período"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Gasto no período</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakfast.byItem.map((i) => (
                  <TableRow key={i.label}>
                    <TableCell>{i.label}</TableCell>
                    <TableCell>{fmt(i.total)}</TableCell>
                  </TableRow>
                ))}
                {breakfast.byItem.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Nenhuma compra da categoria &quot;Café da manhã&quot; vinculada a item de estoque no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Custo médio por prato/produto servido (1 porção)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prato/produto</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Custo por porção</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dishes.map((d) => (
                  <TableRow key={`${d.kind}-${d.dish_id}`}>
                    <TableCell>{d.dish_name}</TableCell>
                    <TableCell>{d.kind === "minibar" ? "Frigobar" : "Bar da piscina"}</TableCell>
                    <TableCell>{d.has_recipe ? fmt(d.unit_cost) : "sem receita cadastrada"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

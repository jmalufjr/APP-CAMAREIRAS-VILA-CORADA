import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  getCostCentersSummaryForPeriod,
  getOccupiedRoomNightsForPeriod,
  getBreakfastCostForPeriod,
  getDishCostsForPeriod,
} from "@/lib/actions/cost-accounting";
import { hospedagemTotalIncludingBreakfast } from "@/lib/cost-accounting";
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

  const [summary, occupiedRoomNights, dishes] = await Promise.all([
    getCostCentersSummaryForPeriod(from, to),
    getOccupiedRoomNightsForPeriod(from, to),
    getDishCostsForPeriod(from, to),
  ]);
  const breakfast = await getBreakfastCostForPeriod(from, to, summary);

  const hospedagemTotal = hospedagemTotalIncludingBreakfast(summary.centerTotals);
  const costPerOccupiedNight = occupiedRoomNights > 0 ? hospedagemTotal / occupiedRoomNights : null;

  return (
    <div className="space-y-6">
      <BackLink href="/custos-despesas" />
      <PageHeader
        title="Custos"
        subtitle="Custo da hospedagem (já incluindo o café da manhã, embutido na diária), por centro de custo, do café da manhã em detalhe, e de cada prato/produto do bar e do frigobar."
      />
      <DateRangeFilter basePath="/custos-despesas/custos" from={from} to={to} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Hospedagem (+ café da manhã)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-medium">{fmt(hospedagemTotal)}</p>
          </CardContent>
        </Card>
        {summary.centerTotals.map((c) => (
          <Card key={c.center_id}>
            <CardHeader>
              <CardTitle className="font-heading text-base">{c.center_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-medium">{fmt(c.total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        &quot;Hospedagem (+ café da manhã)&quot; soma o custo do centro Hospedagem com o do Café da manhã — o café não
        é cobrado à parte do hóspede, então seu custo faz parte do custo da diária. O card &quot;Café da manhã&quot;
        mostra esse mesmo valor separado, só pra referência.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Custo médio por diária ocupada · {occupiedRoomNights} diária(s) ocupada(s) no período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-medium">{costPerOccupiedNight !== null ? fmt(costPerOccupiedNight) : "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Rateio dos custos, por item de custo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item de custo</TableHead>
                  <TableHead>Gasto total</TableHead>
                  <TableHead>Subcentro</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Valor no centro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.breakdown.flatMap((row) =>
                  row.by_subcenter.length > 0 ? (
                    row.by_subcenter.map((s, i) => (
                      <TableRow key={`${row.cost_item_id}-${s.subcenter_id}-${s.center_id}`}>
                        {i === 0 && <TableCell rowSpan={row.by_subcenter.length}>{row.cost_item_name}</TableCell>}
                        {i === 0 && <TableCell rowSpan={row.by_subcenter.length}>{fmt(row.total_spend)}</TableCell>}
                        <TableCell>{s.subcenter_name}</TableCell>
                        <TableCell>{s.center_name}</TableCell>
                        <TableCell>{fmt(s.amount)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow key={row.cost_item_id}>
                      <TableCell>{row.cost_item_name}</TableCell>
                      <TableCell>{fmt(row.total_spend)}</TableCell>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        Sem subcentro vinculado
                      </TableCell>
                    </TableRow>
                  )
                )}
                {summary.breakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma despesa vinculada a item de custo no período.
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
                      Nenhuma compra do centro &quot;Café da manhã&quot; vinculada a item de custo no período.
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

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
  getBarFrigobarCmvForPeriod,
} from "@/lib/actions/cost-accounting";
import { getCostItems, getCostCenters } from "@/lib/actions/cost-plan";
import { RateioEditButton } from "./rateio-edit-button";
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

  const [summary, occupiedRoomNights, dishes, breakfast, barFrigobarCmv, allItems, centers] = await Promise.all([
    getCostCentersSummaryForPeriod(from, to),
    getOccupiedRoomNightsForPeriod(from, to),
    getDishCostsForPeriod(from, to),
    getBreakfastCostForPeriod(from, to),
    getBarFrigobarCmvForPeriod(from, to),
    getCostItems(),
    getCostCenters(),
  ]);
  const registeredByItem = new Map(allItems.map((i) => [i.id, i.centers]));
  const centerOptions = centers.filter((c) => c.active).map((c) => ({ id: c.id, label: c.name }));

  const hospedagemTotal = hospedagemTotalIncludingBreakfast(summary.centerTotals);
  const costPerOccupiedNight = occupiedRoomNights > 0 ? hospedagemTotal / occupiedRoomNights : null;

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/demonstrativos" />
      <PageHeader
        title="Demonstrativo de Custos"
        subtitle="Lido direto do livro contábil (os mesmos lançamentos dos balancetes): custo da hospedagem (já incluindo o café da manhã, embutido na diária), por centro de custo, do café da manhã em detalhe, e de cada prato/produto do bar e do frigobar."
      />
      <DateRangeFilter basePath="/contabil/demonstrativos/custos" from={from} to={to} />

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
          <CardTitle className="font-heading text-lg">Rateio dos custos, por produto/despesa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            “Valor no centro” é o que foi lançado no livro no período. “Rateio cadastrado” é a divisão predefinida no
            cadastro do produto/despesa — a única fonte de rateio do sistema; o lápis edita esse mesmo cadastro (vale
            para os próximos lançamentos). Produtos de estoque são custo só quando consumidos: o centro vem de onde
            foram consumidos (bar, frigobar, café…) e, quando não há destino (perdas, inventário), segue este rateio.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item de custo</TableHead>
                  <TableHead>Gasto total</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Valor no centro</TableHead>
                  <TableHead>Rateio cadastrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.breakdown.flatMap((row) =>
                  row.by_center.length > 0 ? (
                    row.by_center.map((c, i) => (
                      <TableRow key={`${row.cost_item_id}-${c.center_id}`}>
                        {i === 0 && <TableCell rowSpan={row.by_center.length}>{row.cost_item_name}</TableCell>}
                        {i === 0 && <TableCell rowSpan={row.by_center.length}>{fmt(row.total_spend)}</TableCell>}
                        <TableCell>{c.center_name}</TableCell>
                        <TableCell>{fmt(c.amount)}</TableCell>
                        {i === 0 && (
                          <TableCell rowSpan={row.by_center.length}>
                            <div className="flex items-center gap-1">
                              <span className="text-xs">
                                {(registeredByItem.get(row.cost_item_id) ?? []).map((x) => `${x.center_name} ${x.alloc_pct}%`).join(" · ") || "—"}
                              </span>
                              {registeredByItem.has(row.cost_item_id) && (
                                <RateioEditButton
                                  costItemId={row.cost_item_id}
                                  name={row.cost_item_name}
                                  initial={(registeredByItem.get(row.cost_item_id) ?? []).map((x) => ({ id: x.center_id, pct: x.alloc_pct }))}
                                  centerOptions={centerOptions}
                                />
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow key={row.cost_item_id}>
                      <TableCell>{row.cost_item_name}</TableCell>
                      <TableCell>{fmt(row.total_spend)}</TableCell>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        Sem centro vinculado
                      </TableCell>
                    </TableRow>
                  )
                )}
                {summary.breakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum custo lançado no período.
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
          <CardTitle className="font-heading text-lg">Café da manhã · {breakfast.guestsServed} café(s) servido(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {breakfast.guestNights} hóspede(s)-noite no período (informativo). O custo por café usa &quot;cafés
            servidos&quot;, editável pra baixo em cada dia (ver &quot;Mesas do café&quot;). Tudo vem do livro: compras
            marcadas &quot;para o café da manhã&quot;, baixas de estoque com destino café e a parte do café nas
            despesas rateadas.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Custo de insumos por café servido</p>
              <p className="text-lg font-medium">
                {breakfast.costPerGuestInsumos !== null ? fmt(breakfast.costPerGuestInsumos) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Total de insumos: {fmt(breakfast.insumosCost)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Custo total por café servido</p>
              <p className="text-lg font-medium">
                {breakfast.costPerGuestTotal !== null ? fmt(breakfast.costPerGuestTotal) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Total do centro: {fmt(breakfast.totalCost)} (insumos + outros custos diretos)
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Como entrou</TableHead>
                  <TableHead>Valor no período</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakfast.byItem.map((i) => (
                  <TableRow key={i.label}>
                    <TableCell>{i.label}</TableCell>
                    <TableCell>{i.method === "comprado" ? "Compra/despesa lançada" : "Baixado do estoque (custo médio)"}</TableCell>
                    <TableCell>{fmt(i.total)}</TableCell>
                  </TableRow>
                ))}
                {breakfast.byItem.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum item de custo ligado ao centro &quot;Café da manhã&quot; no período.
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
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">CMV e margem bruta · Bar da piscina + Frigobar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Receita reconhecida quando a conta da suíte é fechada; CMV (custo da mercadoria vendida) no momento do
            pedido — os dois podem cair em dias diferentes pra uma mesma venda, não é um erro. Bar e frigobar
            somados juntos.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Receita bruta</p>
              <p className="text-lg font-medium">{fmt(barFrigobarCmv.revenue)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">CMV</p>
              <p className="text-lg font-medium">{fmt(barFrigobarCmv.cmv)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Margem bruta</p>
              <p className="text-lg font-medium">{fmt(barFrigobarCmv.grossMargin)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Margem bruta %</p>
              <p className="text-lg font-medium">
                {barFrigobarCmv.grossMarginPct !== null ? `${barFrigobarCmv.grossMarginPct.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

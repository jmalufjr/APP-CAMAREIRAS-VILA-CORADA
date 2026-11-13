import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { getProductCostReport } from "@/lib/actions/product-cost";
import { todayKey } from "@/lib/date";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function CustoProdutosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayKey().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const r = await getProductCostReport(month);

  return (
    <div className="space-y-6 max-w-4xl">
      <BackLink href="/contabil" />
      <PageHeader
        title="Rentabilidade de Petiscos e Drinks"
        subtitle="Estimativa do mês: o que foi comprado dos ingredientes (parte do Bar) é dividido entre os produtos na proporção das unidades vendidas e da quantidade de cada ingrediente na ficha técnica."
      />
      <div className="flex items-center gap-2">
        <Link href={`/contabil/custo-produtos?mes=${prev}`}>
          <Button variant="outline" size="sm">← {prev.split("-").reverse().join("/")}</Button>
        </Link>
        <span className="text-sm font-medium px-2">{month.split("-").reverse().join("/")}</span>
        <Link href={`/contabil/custo-produtos?mes=${next}`}>
          <Button variant="outline" size="sm">{next.split("-").reverse().join("/")} →</Button>
        </Link>
      </div>

      {"error" in r ? (
        <p className="text-sm text-red-600">{r.error}</p>
      ) : r.rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Sem vendas nem custos de ingredientes neste mês.</p>
      ) : (
        <>
          {(["Petiscos", "Drinks"] as const).map((cat) => {
            const rows = r.rows.filter((row) => row.category === cat);
            const sold = rows.reduce((sum, row) => sum + row.sold, 0);
            const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
            const cost = rows.reduce((sum, row) => sum + row.cost, 0);
            const profit = revenue - cost;
            const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;
            return (
              <section key={cat} className="space-y-2">
                <h3 className="font-heading text-lg">{cat}</h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card p-4">Sem vendas nem custos de {cat.toLowerCase()} neste mês.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border bg-card">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs">
                        <tr>
                          <th className="p-2">Produto</th>
                          <th className="p-2 text-right">Vendidos</th>
                          <th className="p-2 text-right">Receita</th>
                          <th className="p-2 text-right">Custo estimado</th>
                          <th className="p-2 text-right">Custo médio / un.</th>
                          <th className="p-2 text-right">Resultado</th>
                          <th className="p-2 text-right">Margem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            <td className="p-2">
                              {row.name}
                              {!row.hasRecipe && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">· sem ficha técnica</span>}
                            </td>
                            <td className="p-2 text-right">{row.sold}</td>
                            <td className="p-2 text-right">{brl(row.revenue)}</td>
                            <td className="p-2 text-right">{brl(row.cost)}</td>
                            <td className="p-2 text-right">{row.avgCost === null ? "—" : brl(row.avgCost)}</td>
                            <td className={`p-2 text-right ${row.profit < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{brl(row.profit)}</td>
                            <td className="p-2 text-right">{row.marginPct === null ? "—" : `${row.marginPct}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-border bg-muted/30 font-medium">
                        <tr>
                          <td className="p-2">Total de {cat}</td>
                          <td className="p-2 text-right">{sold}</td>
                          <td className="p-2 text-right">{brl(revenue)}</td>
                          <td className="p-2 text-right">{brl(cost)}</td>
                          <td className="p-2 text-right">—</td>
                          <td className={`p-2 text-right ${profit < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{brl(profit)}</td>
                          <td className="p-2 text-right">{margin === null ? "—" : `${margin}%`}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Custo total de ingredientes do Bar no mês: {brl(r.totalIngredientBarCost)}.
            {r.unassignedCost > 0 && ` ${brl(r.unassignedCost)} não foram atribuídos a nenhum produto (ingrediente sem produto vendido que o use na ficha técnica).`}{" "}
            Valores aproximados: não consideram sobras nem perdas.
          </p>
        </>
      )}
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getExpenseDemonstrativoForPeriod } from "@/lib/actions/cost-accounting";
import { toDateKey, nowInBrazil, monthYearLabelPt } from "@/lib/date";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}

export default async function DemonstrativoDespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;

  const rows = await getExpenseDemonstrativoForPeriod(from, to);

  const months = [...new Set(rows.map((r) => r.month))].sort().reverse();
  const centers = [...new Set(rows.map((r) => r.center_name))].sort();
  const totalByMonthCenter = new Map(rows.map((r) => [`${r.month}__${r.center_name}`, r.total]));
  const totalByMonth = new Map<string, number>();
  rows.forEach((r) => totalByMonth.set(r.month, (totalByMonth.get(r.month) ?? 0) + r.total));

  return (
    <div className="space-y-6">
      <BackLink href="/custos-despesas" />
      <PageHeader
        title="Demonstrativo de Despesas"
        subtitle="Todas as despesas do período, mês a mês, por centro de custo — reagrupa sozinho quando o Plano de Contas é editado."
      />
      <DateRangeFilter basePath="/custos-despesas/demonstrativo" from={from} to={to} />

      <Card>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Centro de custo</TableHead>
                  {months.map((m) => (
                    <TableHead key={m}>{monthYearLabelPt(m + "-01")}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {centers.map((center) => (
                  <TableRow key={center}>
                    <TableCell>{center}</TableCell>
                    {months.map((m) => (
                      <TableCell key={m}>R$ {(totalByMonthCenter.get(`${m}__${center}`) ?? 0).toFixed(2)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {centers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={months.length + 1} className="text-center text-muted-foreground">
                      Nenhuma despesa no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {centers.length > 0 && (
                <TableFooter>
                  <TableRow className="font-medium">
                    <TableCell>Total</TableCell>
                    {months.map((m) => (
                      <TableCell key={m}>R$ {(totalByMonth.get(m) ?? 0).toFixed(2)}</TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

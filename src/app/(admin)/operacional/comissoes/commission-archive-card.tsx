import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthYearLabelPt } from "@/lib/date";
import type { CommissionArchiveMonth } from "@/lib/actions/commission";

const money = (n: number) => `R$ ${n.toFixed(2)}`;

export function CommissionArchiveCard({ months }: { months: CommissionArchiveMonth[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Registro mensal das comissões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Valores de cada mês já encerrado (nota de cada camareira, comissão de suítes e café, comissão de bar e total). Quando o
          mês vira, o mês que era &ldquo;mês anterior&rdquo; passa para este registro, com os valores congelados, e libera o
          cálculo do mês que acabou de fechar.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Camareira</TableHead>
                <TableHead className="text-right">Nota</TableHead>
                <TableHead className="text-right">Suítes e Café</TableHead>
                <TableHead className="text-right">Bar</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.flatMap((m) => [
                ...m.rows.map((r, i) => (
                  <TableRow key={`${m.periodEnd}-${r.camareira_name}`}>
                    <TableCell className="font-medium">{i === 0 ? monthYearLabelPt(m.periodEnd) : ""}</TableCell>
                    <TableCell>{r.camareira_name}</TableCell>
                    <TableCell className="text-right">{r.score}</TableCell>
                    <TableCell className="text-right">{money(r.suites_cafe_amount)}</TableCell>
                    <TableCell className="text-right">{money(r.bar_amount)}</TableCell>
                    <TableCell className="text-right">{money(r.total_amount)}</TableCell>
                  </TableRow>
                )),
                <TableRow key={`${m.periodEnd}-total`} className="bg-muted/40">
                  <TableCell colSpan={3} className="font-medium">
                    Total de {monthYearLabelPt(m.periodEnd)}
                  </TableCell>
                  <TableCell className="text-right font-medium">{money(m.totalSuitesCafe)}</TableCell>
                  <TableCell className="text-right font-medium">{money(m.totalBar)}</TableCell>
                  <TableCell className="text-right font-medium">{money(m.grandTotal)}</TableCell>
                </TableRow>,
              ])}
              {months.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Ainda não há meses registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

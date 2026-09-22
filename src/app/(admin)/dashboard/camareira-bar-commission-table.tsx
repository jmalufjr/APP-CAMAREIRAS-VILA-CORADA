import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CamareiraBarCommissionRow } from "@/lib/actions/comandas";
import { monthYearLabelPt } from "@/lib/date";

// Comissão de 10% do bar da piscina, por camareira (quem lançou a comanda
// originalmente — ver getBarCommissionScreenSummary): estimativa do mês
// corrente e último período fechado lado a lado, cada camareira numa
// linha só. Desde a Parte 36, o "último período" segue o mesmo corte no
// dia 25 (não no fim do mês) já usado pela comissão de serviços nas
// suítes e no café — diferente daquela, aqui o valor é sempre calculado
// ao vivo (não existe nota editável pra capturar num instante, então não
// precisa de um botão "Calcular").
export function CamareiraBarCommissionTable({
  currentMonthEstimate,
  closedPeriod,
}: {
  currentMonthEstimate: CamareiraBarCommissionRow[];
  closedPeriod: { periodEnd: string; rows: CamareiraBarCommissionRow[] };
}) {
  const currentById = new Map(currentMonthEstimate.map((r) => [r.camareira_id ?? r.camareira_name, r]));
  const closedById = new Map(closedPeriod.rows.map((r) => [r.camareira_id ?? r.camareira_name, r]));
  const allKeys = new Set([...currentById.keys(), ...closedById.keys()]);

  const rows = Array.from(allKeys)
    .map((key) => {
      const current = currentById.get(key);
      const closed = closedById.get(key);
      return {
        key,
        name: current?.camareira_name ?? closed?.camareira_name ?? "—",
        current: current?.commission ?? 0,
        closed: closed?.commission ?? 0,
      };
    })
    .sort((a, b) => b.current - a.current);

  const totalCurrent = rows.reduce((sum, r) => sum + r.current, 0);
  const totalClosed = rows.reduce((sum, r) => sum + r.closed, 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        &ldquo;Mês corrente (estimativa)&rdquo; soma as comandas lançadas desde o dia 1º deste mês até hoje, e
        muda dia a dia. &ldquo;Último período ({monthYearLabelPt(closedPeriod.periodEnd)})&rdquo; é o valor
        definitivo do período já fechado — de 26 do mês anterior a 25 deste, o mesmo corte usado na comissão de
        serviços nas suítes e no café — e não muda mais, já que o período está encerrado.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Camareira</TableHead>
              <TableHead className="text-right">Mês corrente (estimativa)</TableHead>
              <TableHead className="text-right">Último período ({monthYearLabelPt(closedPeriod.periodEnd)})</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right">R$ {r.current.toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {r.closed.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhuma comanda lançada nesses dois períodos.
                </TableCell>
              </TableRow>
            )}
            {rows.length > 0 && (
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="text-right font-medium">R$ {totalCurrent.toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">R$ {totalClosed.toFixed(2)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

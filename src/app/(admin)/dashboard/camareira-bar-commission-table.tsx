import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CamareiraBarCommissionRow } from "@/lib/actions/comandas";

// Comissão de 10% do bar da piscina, por camareira (quem lançou a comanda
// originalmente — ver getBarCommissionByCamareira) — mês atual e mês
// anterior lado a lado, cada camareira numa linha só.
export function CamareiraBarCommissionTable({
  currentMonth,
  previousMonth,
}: {
  currentMonth: CamareiraBarCommissionRow[];
  previousMonth: CamareiraBarCommissionRow[];
}) {
  const currentById = new Map(currentMonth.map((r) => [r.camareira_id ?? r.camareira_name, r]));
  const previousById = new Map(previousMonth.map((r) => [r.camareira_id ?? r.camareira_name, r]));
  const allKeys = new Set([...currentById.keys(), ...previousById.keys()]);

  const rows = Array.from(allKeys)
    .map((key) => {
      const current = currentById.get(key);
      const previous = previousById.get(key);
      return {
        key,
        name: current?.camareira_name ?? previous?.camareira_name ?? "—",
        current: current?.commission ?? 0,
        previous: previous?.commission ?? 0,
      };
    })
    .sort((a, b) => b.current - a.current);

  const totalCurrent = rows.reduce((sum, r) => sum + r.current, 0);
  const totalPrevious = rows.reduce((sum, r) => sum + r.previous, 0);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Camareira</TableHead>
            <TableHead className="text-right">Mês atual</TableHead>
            <TableHead className="text-right">Mês anterior</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-right">R$ {r.current.toFixed(2)}</TableCell>
              <TableCell className="text-right">R$ {r.previous.toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                Nenhuma comanda lançada nesses dois meses.
              </TableCell>
            </TableRow>
          )}
          {rows.length > 0 && (
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-medium">R$ {totalCurrent.toFixed(2)}</TableCell>
              <TableCell className="text-right font-medium">R$ {totalPrevious.toFixed(2)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MinibarItemTotal } from "@/lib/actions/minibar";

// Tabela combinada abaixo do par de gráficos de pizza (valor + quantidade)
// de uma mesma seção (mês atual ou desde o início) — uma linha por item,
// com o percentual de cada métrica lado a lado, ordenada pelo percentual
// de valor do maior para o menor.
export function MinibarPercentTable({ items }: { items: MinibarItemTotal[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sem consumo registrado.</p>;
  }

  const totalValue = items.reduce((sum, i) => sum + i.total, 0);
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  const rows = items
    .map((item) => ({
      name: item.name,
      valuePercent: totalValue > 0 ? (item.total / totalValue) * 100 : 0,
      quantityPercent: totalQuantity > 0 ? (item.quantity / totalQuantity) * 100 : 0,
    }))
    .sort((a, b) => b.valuePercent - a.valuePercent);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right">{row.valuePercent.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{row.quantityPercent.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

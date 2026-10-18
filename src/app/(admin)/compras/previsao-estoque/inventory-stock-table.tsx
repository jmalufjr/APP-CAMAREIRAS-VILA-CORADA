import { Fragment } from "react";
import type { InventoryStockReportRow } from "@/lib/actions/inventory-report";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Agrupado por categoria — uma linha de cabeçalho por categoria, seguida
// dos itens dela, pra ficar fácil de ler mesmo com muitos itens.
export function InventoryStockTable({ rows }: { rows: InventoryStockReportRow[] }) {
  const byCategory = new Map<string, InventoryStockReportRow[]>();
  rows.forEach((r) => {
    const list = byCategory.get(r.category_name) ?? [];
    list.push(r);
    byCategory.set(r.category_name, list);
  });
  const totalValue = rows.reduce((sum, r) => sum + r.stock_value, 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Comprado no mês</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Custo médio</TableHead>
            <TableHead>Valor em estoque</TableHead>
            <TableHead>Dias restantes (estimado)</TableHead>
            <TableHead>Lista de compras</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from(byCategory.entries()).map(([category, items]) => (
            <Fragment key={category}>
              <TableRow className="bg-muted/40">
                <TableCell colSpan={7} className="font-medium text-xs uppercase text-muted-foreground">
                  {category}
                </TableCell>
              </TableRow>
              {items.map((r) => (
                <TableRow key={r.inventory_item_id}>
                  <TableCell>{r.item_name}</TableCell>
                  <TableCell>
                    {r.purchased_this_month} {r.unit}
                  </TableCell>
                  <TableCell>
                    {r.balance} {r.unit}
                  </TableCell>
                  <TableCell>R$ {r.avg_cost.toFixed(2)}</TableCell>
                  <TableCell>R$ {r.stock_value.toFixed(2)}</TableCell>
                  <TableCell>{r.estimated_days_remaining !== null ? `${r.estimated_days_remaining} dias` : "—"}</TableCell>
                  <TableCell>
                    {r.needs_purchase && <Badge variant="destructive">Está na lista de compras</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Nenhum item de estoque cadastrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {rows.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-medium">
                Valor total em estoque
              </TableCell>
              <TableCell className="font-medium">R$ {totalValue.toFixed(2)}</TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

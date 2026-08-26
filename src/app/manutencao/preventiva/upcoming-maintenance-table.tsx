import type { MaintenanceItemRow } from "@/lib/actions/maintenance";
import { EXECUTION_TYPE_LABELS, periodicityLabel } from "@/lib/maintenance";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function UpcomingMaintenanceTable({ items }: { items: MaintenanceItemRow[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum item previsto nos próximos 30 dias.</p>;
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data prevista</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Execução</TableHead>
              <TableHead>Periodicidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.next_due_date.split("-").reverse().join("/")}</TableCell>
                <TableCell>{item.category_name}</TableCell>
                <TableCell>{item.label}</TableCell>
                <TableCell>
                  <Badge variant={item.execution_type === "tecnico" ? "outline" : "secondary"}>
                    {EXECUTION_TYPE_LABELS[item.execution_type]}
                  </Badge>
                </TableCell>
                <TableCell>{periodicityLabel(item.periodicity_days)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

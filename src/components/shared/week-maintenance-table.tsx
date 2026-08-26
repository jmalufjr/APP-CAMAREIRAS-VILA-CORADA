import type { WeekMaintenanceRow } from "@/lib/actions/maintenance";
import { EXECUTION_TYPE_LABELS, MAINTENANCE_STATUS_LABELS } from "@/lib/maintenance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatBr(dateKey: string) {
  return dateKey.split("-").reverse().join("/");
}

function formatDateTimeBr(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WeekMaintenanceTable({ rows }: { rows: WeekMaintenanceRow[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Execução</TableHead>
              <TableHead>Data prevista</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Selecionada por</TableHead>
              <TableHead>Concluída em</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Técnico externo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.category_name}</TableCell>
                <TableCell>{row.item_label}</TableCell>
                <TableCell>{EXECUTION_TYPE_LABELS[row.execution_type]}</TableCell>
                <TableCell>{formatBr(row.due_date)}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "concluida" ? "default" : row.status === "selecionada" ? "outline" : "secondary"}>
                    {MAINTENANCE_STATUS_LABELS[row.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.selected_by_name ?? "—"}
                  {row.selected_at && ` · ${formatDateTimeBr(row.selected_at)}`}
                </TableCell>
                <TableCell>{row.completed_at ? formatDateTimeBr(row.completed_at) : "—"}</TableCell>
                <TableCell>{row.completed_by_name ?? "—"}</TableCell>
                <TableCell>{row.external_technician_name ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nada previsto ou concluído neste período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

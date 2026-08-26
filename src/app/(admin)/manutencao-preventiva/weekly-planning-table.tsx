import Link from "next/link";
import type { WeeklyPlanningRow } from "@/lib/actions/maintenance";
import { MAINTENANCE_STATUS_LABELS } from "@/lib/maintenance";
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
  return dateKey.split("-").slice(1).reverse().join("/");
}

export function WeeklyPlanningTable({ rows }: { rows: WeeklyPlanningRow[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Categorias</TableHead>
              <TableHead>Execução</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.weekStart}>
                <TableCell>
                  <Link href={`/manutencao-preventiva/semana/${row.weekStart}`} className="text-primary hover:underline font-medium">
                    {formatBr(row.weekStart)} a {formatBr(row.weekEnd)}
                  </Link>
                </TableCell>
                <TableCell>{row.categories}</TableCell>
                <TableCell>{row.execution}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "concluida" ? "default" : row.status === "selecionada" ? "outline" : "secondary"}>
                    {MAINTENANCE_STATUS_LABELS[row.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nada previsto no período selecionado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

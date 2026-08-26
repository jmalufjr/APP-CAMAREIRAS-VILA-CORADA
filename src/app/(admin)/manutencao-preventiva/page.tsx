import { PageHeader } from "@/components/shared/page-header";
import { getAdminPreventivaOverview } from "@/lib/actions/maintenance";
import { EXECUTION_TYPE_LABELS, MAINTENANCE_STATUS_LABELS, periodicityLabel } from "@/lib/maintenance";
import { todayKey, tomorrowKey } from "@/lib/date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatBr(dateKey: string) {
  return dateKey.split("-").reverse().join("/");
}

function tempoRestante(dateKey: string) {
  const today = todayKey();
  const tomorrow = tomorrowKey();
  if (dateKey === today) return "Hoje";
  if (dateKey === tomorrow) return "Amanhã";
  if (dateKey < today) return "Atrasado";
  return formatBr(dateKey);
}

function formatDateTimeBr(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminManutencaoPreventivaPage() {
  const { pendingTodayTomorrow, completedTodayTomorrow, nextTwoMonths } = await getAdminPreventivaOverview();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manutenção Preventiva"
        subtitle="Hoje, amanhã e os próximos dois meses de manutenção preventiva, por categoria e item."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Pendentes e selecionadas · hoje / amanhã</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Data prevista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Execução</TableHead>
                <TableHead>Selecionada por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingTodayTomorrow.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.category_name}</TableCell>
                  <TableCell>{item.label}</TableCell>
                  <TableCell>{tempoRestante(item.next_due_date)}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "selecionada" ? "default" : "secondary"}>
                      {MAINTENANCE_STATUS_LABELS[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{EXECUTION_TYPE_LABELS[item.execution_type]}</TableCell>
                  <TableCell>{item.selected_by_profile?.name ?? "—"}</TableCell>
                </TableRow>
              ))}
              {pendingTodayTomorrow.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nada pendente para hoje ou amanhã.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Concluídas · hoje / amanhã</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Execução</TableHead>
                <TableHead>Concluída em</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Técnico externo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedTodayTomorrow.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.category_name}</TableCell>
                  <TableCell>{c.item_label}</TableCell>
                  <TableCell>{EXECUTION_TYPE_LABELS[c.execution_type]}</TableCell>
                  <TableCell>{formatDateTimeBr(c.completed_at)}</TableCell>
                  <TableCell>{c.completed_by_profile?.name ?? "—"}</TableCell>
                  <TableCell>{c.external_technician_name ?? "—"}</TableCell>
                </TableRow>
              ))}
              {completedTodayTomorrow.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma conclusão hoje ou amanhã.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Próximos dois meses</h2>
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
                {nextTwoMonths.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatBr(item.next_due_date)}</TableCell>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{EXECUTION_TYPE_LABELS[item.execution_type]}</TableCell>
                    <TableCell>{periodicityLabel(item.periodicity_days)}</TableCell>
                  </TableRow>
                ))}
                {nextTwoMonths.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nada previsto nos próximos dois meses.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

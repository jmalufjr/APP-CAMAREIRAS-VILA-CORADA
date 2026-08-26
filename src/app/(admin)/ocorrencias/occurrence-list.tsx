import { TASK_TYPE_LABELS } from "@/lib/task-type";
import type { DayTaskRow } from "@/lib/actions/occurrences";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS = {
  pendente: "Pendente",
  selecionada: "Selecionada",
  resolvida: "Resolvida",
} as const;

function formatDateTimePt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OccurrenceList({ items }: { items: DayTaskRow[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma ocorrência ou observação registrada.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {items.map((t) => (
        <Card key={t.id}>
          <CardContent className="space-y-2">
            <p className="font-medium text-sm">
              Quarto {t.rooms?.number ?? "—"} · {TASK_TYPE_LABELS[t.task_type]}
            </p>
            <p className="text-xs text-muted-foreground">Camareira: {t.profiles?.name ?? "—"}</p>
            {t.daily_room_task_occurrences?.length > 0 && (
              <div className="space-y-1.5">
                {t.daily_room_task_occurrences.map((o) => (
                  <div key={o.id} className="rounded-lg bg-muted px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{o.occurrence_categories?.name ?? "—"}</Badge>
                      <Badge variant={o.status === "resolvida" ? "default" : "outline"}>
                        {STATUS_LABELS[o.status]}
                      </Badge>
                    </div>
                    {o.description && <p className="text-sm">{o.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      Registrada em {formatDateTimePt(o.created_at)}
                    </p>
                    {o.selected_by_profile && (
                      <p className="text-xs text-muted-foreground">
                        Selecionada por {o.selected_by_profile.name}
                        {o.selected_at && ` em ${formatDateTimePt(o.selected_at)}`}
                      </p>
                    )}
                    {o.resolved_by_profile && (
                      <p className="text-xs text-muted-foreground">
                        Resolvida por {o.resolved_by_profile.name}
                        {o.resolved_at && ` em ${formatDateTimePt(o.resolved_at)}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {t.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Observações</p>
                <p className="text-sm">{t.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

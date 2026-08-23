import { TASK_TYPE_LABELS } from "@/lib/task-type";
import type { DayTaskRow } from "@/lib/actions/occurrences";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
                  <div key={o.id} className="rounded-lg bg-muted px-3 py-2">
                    <Badge variant="secondary">{o.occurrence_categories?.name ?? "—"}</Badge>
                    {o.description && <p className="text-sm mt-1">{o.description}</p>}
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

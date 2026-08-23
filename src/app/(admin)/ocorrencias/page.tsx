import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { todayKey, yesterdayKey, formatDatePt } from "@/lib/date";
import type { ChecklistType } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { History } from "lucide-react";

interface OccurrenceRow {
  id: string;
  description: string | null;
  occurrence_categories: { name: string } | null;
}
interface TaskRow {
  id: string;
  task_type: ChecklistType;
  notes: string | null;
  rooms: { number: string } | null;
  profiles: { name: string } | null;
  daily_room_task_occurrences: OccurrenceRow[];
}

export default async function OcorrenciasPage() {
  const supabase = await createClient();
  const today = todayKey();
  const yesterday = yesterdayKey();

  const { data: tasks } = await supabase
    .from("daily_room_tasks")
    .select(
      "id, date, task_type, notes, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name), daily_room_task_occurrences(id, description, occurrence_categories(name))"
    )
    .in("date", [today, yesterday])
    .order("date", { ascending: false });

  const rows = (tasks ?? []) as unknown as (TaskRow & { date: string })[];
  const withContent = rows.filter(
    (t) => t.notes || (t.daily_room_task_occurrences?.length ?? 0) > 0
  );

  const byDate = new Map<string, typeof withContent>();
  withContent.forEach((t) => {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ocorrências e observações"
        subtitle="Detalhes de hoje e de ontem, por quarto."
        action={
          <Link
            href="/ocorrencias/historico"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline"
          >
            <History size={15} /> Ver histórico de 30 dias
          </Link>
        }
      />

      {[today, yesterday].map((date) => {
        const items = byDate.get(date) ?? [];
        return (
          <div key={date} className="space-y-3">
            <h2 className="font-heading text-lg text-primary capitalize">{formatDatePt(date)}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ocorrência ou observação registrada.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {items.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">
                          Quarto {t.rooms?.number ?? "—"} · {TASK_TYPE_LABELS[t.task_type]}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Camareira: {t.profiles?.name ?? "—"}
                      </p>
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
            )}
          </div>
        );
      })}
    </div>
  );
}

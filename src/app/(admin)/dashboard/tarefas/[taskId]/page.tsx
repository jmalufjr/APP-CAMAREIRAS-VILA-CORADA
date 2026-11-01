import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatDatePt, formatTimePt, formatDurationPt } from "@/lib/date";
import type { ChecklistType, DailyRoomTaskOccurrence } from "@/lib/types";
import { ChecklistDetail } from "@/components/shared/checklist-detail";
import { WaiveReviewButton } from "@/components/shared/waive-review-button";
import { Card, CardContent } from "@/components/ui/card";
import { TASK_STATUS_LABELS } from "@/lib/types";
import { getRoomBillSnapshotForDate } from "@/lib/actions/room-bills";
import { signOccurrencePhotoUrls } from "@/lib/occurrence-photos";

// Visão somente-leitura do admin de um serviço já concluído (ou cancelado)
// pela camareira — mesmo componente ChecklistDetail da tela dela, que já
// trava tudo (checkboxes, formulários) quando o status é "concluido". Não
// recebe `minibar` (edição): em vez disso recebe `minibarSnapshot`, um
// retrato somente-leitura da conta vigente na data da tarefa.
export default async function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("daily_room_tasks")
    .select("*, rooms(number, name), profiles!daily_room_tasks_assigned_to_fkey(name), reviewer:profiles!daily_room_tasks_reviewed_by_fkey(name)")
    .eq("id", taskId)
    .single();

  if (!task) notFound();

  const [{ data: checks }, { data: occurrencesRaw }, { data: categories }, minibarSnapshot] = await Promise.all([
    supabase
      .from("daily_room_task_checks")
      .select("*, checklist_items(label, description, position)")
      .eq("daily_room_task_id", taskId)
      .order("checklist_items(position)"),
    supabase
      .from("daily_room_task_occurrences")
      .select("*, occurrence_categories(name), daily_room_task_occurrence_photos(id, storage_path)")
      .eq("daily_room_task_id", taskId),
    supabase.from("occurrence_categories").select("*").eq("active", true).order("position"),
    getRoomBillSnapshotForDate(task.room_id, task.date),
  ]);

  type OccurrenceRawRow = DailyRoomTaskOccurrence & {
    occurrence_categories: { name: string };
    daily_room_task_occurrence_photos: { id: string; storage_path: string }[];
  };
  const occurrenceRows = (occurrencesRaw ?? []) as unknown as OccurrenceRawRow[];
  const photoPaths = occurrenceRows.flatMap((o) => o.daily_room_task_occurrence_photos.map((p) => p.storage_path));
  const photoUrlMap = await signOccurrencePhotoUrls(photoPaths);
  const occurrences = occurrenceRows.map((o) => ({
    ...o,
    photos: o.daily_room_task_occurrence_photos.map((p) => ({ id: p.id, url: photoUrlMap.get(p.storage_path) ?? null })),
  }));

  const room = (task as unknown as { rooms: { number: string; name: string | null } }).rooms;
  const reviewerName = (task as unknown as { reviewer: { name: string } | null }).reviewer?.name ?? null;
  const hasReview = !!task.reviewed_by || !!task.review_waived_by || task.status !== "concluido";
  const time = (iso: string | null) => (iso ? formatTimePt(iso) : "—");
  const camareiraName =
    (task as unknown as { profiles: { name: string } | null }).profiles?.name ?? "—";

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title={`Suíte ${room.number} — ${formatDatePt(task.date)}`}
        subtitle={`Checklist de ${TASK_TYPE_LABELS[task.task_type as ChecklistType].toLowerCase()} · ${camareiraName}`}
      />
      {hasReview && (
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading text-lg">Revisão e correção</h3>
              {task.status === "aguardando_revisao" && <WaiveReviewButton taskId={task.id} />}
            </div>
            <p>
              Situação: <strong>{TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}</strong>
              {task.review_waived_by && " · revisão dispensada pela administração"}
            </p>
            {reviewerName && (
              <p>
                Revisora: {reviewerName} · início {time(task.review_claimed_at)} · término {time(task.review_finished_at)} ·
                duração {formatDurationPt(task.review_claimed_at, task.review_finished_at)}
              </p>
            )}
            {task.review_notes && <p className="whitespace-pre-wrap">Observação da revisão: {task.review_notes}</p>}
            {task.reviewed_by && (
              <ul className="space-y-1">
                {(checks ?? []).map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 border-b border-border py-1 last:border-0">
                    <span>{(c as unknown as { checklist_items: { label: string } }).checklist_items.label}</span>
                    <span className="text-muted-foreground">
                      {c.review_result === "incompleto" ? (c.corrected ? "Incompleto · corrigido" : "Incompleto") : c.review_result === "completo" ? "Completo" : "—"}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 py-1">
                  <span>Consumo de frigobar</span>
                  <span className="text-muted-foreground">
                    {task.review_minibar_result === "incompleto"
                      ? task.correction_minibar_done ? "Incompleto · corrigido" : "Incompleto"
                      : task.review_minibar_result === "completo" ? "Completo" : "—"}
                  </span>
                </li>
              </ul>
            )}
            {task.correction_started_at && (
              <p>
                Correção: início {time(task.correction_started_at)} · término {time(task.correction_finished_at)} · duração{" "}
                {formatDurationPt(task.correction_started_at, task.correction_finished_at)}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <ChecklistDetail
        task={task}
        checks={checks ?? []}
        occurrences={occurrences}
        categories={categories ?? []}
        minibarSnapshot={minibarSnapshot}
      />
    </div>
  );
}

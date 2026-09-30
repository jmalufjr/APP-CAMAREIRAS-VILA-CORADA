import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatDatePt } from "@/lib/date";
import type { ChecklistType, DailyRoomTaskOccurrence } from "@/lib/types";
import { ChecklistDetail } from "@/components/shared/checklist-detail";
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
    .select("*, rooms(number, name), profiles!daily_room_tasks_assigned_to_fkey(name)")
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
  const camareiraName =
    (task as unknown as { profiles: { name: string } | null }).profiles?.name ?? "—";

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title={`Suíte ${room.number} — ${formatDatePt(task.date)}`}
        subtitle={`Checklist de ${TASK_TYPE_LABELS[task.task_type as ChecklistType].toLowerCase()} · ${camareiraName}`}
      />
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

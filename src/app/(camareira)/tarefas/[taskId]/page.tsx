import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import type { ChecklistType, DailyRoomTaskOccurrence } from "@/lib/types";
import { getMinibarConsumptionForRoom } from "@/lib/actions/minibar";
import { resolveAutoMinibarGuestSlot } from "@/lib/room-bills";
import { signOccurrencePhotoUrls } from "@/lib/occurrence-photos";
import { ChecklistDetail } from "@/components/shared/checklist-detail";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("daily_room_tasks")
    .select("*, rooms(number, name)")
    .eq("id", taskId)
    .single();

  if (!task) notFound();

  // Resolvido a partir das contas que já existem pra suíte, não do tipo
  // de checklist (ver resolveAutoMinibarGuestSlot).
  const minibarGuestSlot = await resolveAutoMinibarGuestSlot(supabase, task.room_id);

  const [{ data: checks }, { data: occurrencesRaw }, { data: categories }, minibar] = await Promise.all([
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
    getMinibarConsumptionForRoom(task.room_id, minibarGuestSlot),
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

  return (
    <div className="space-y-6">
      <BackLink href="/tarefas" />
      <PageHeader
        title={`Suíte ${room.number}`}
        subtitle={`Checklist de ${TASK_TYPE_LABELS[task.task_type as ChecklistType].toLowerCase()}`}
      />
      <ChecklistDetail
        task={task}
        checks={checks ?? []}
        occurrences={occurrences}
        categories={categories ?? []}
        minibar={minibar}
        minibarGuestSlot={minibarGuestSlot}
      />
    </div>
  );
}

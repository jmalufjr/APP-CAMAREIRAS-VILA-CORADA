import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { taskTypeLabel } from "@/lib/task-type";
import type { ChecklistType, DailyRoomTaskOccurrence } from "@/lib/types";
import { getMinibarConsumptionForRoom } from "@/lib/actions/minibar";
import { resolveAutoMinibarGuestSlot } from "@/lib/room-bills";
import { signOccurrencePhotoUrls } from "@/lib/occurrence-photos";
import { ChecklistDetail } from "@/components/shared/checklist-detail";
import { ReviewPanel } from "@/components/shared/review-panel";
import { CorrectionPanel } from "@/components/shared/correction-panel";
import { getCurrentProfile } from "@/lib/actions/session";

// Itens da Limpeza adicional vêm depois dos do serviço base (cada grupo na própria ordem).
function sortChecksExtrasLast<T extends { checklist_items?: { type?: string; position?: number } | null }>(rows: T[]): T[] {
  const extra = (r: T) => (r.checklist_items?.type === "limpeza_adicional" ? 1 : 0);
  return [...rows].sort((a, b) => extra(a) - extra(b) || (a.checklist_items?.position ?? 0) - (b.checklist_items?.position ?? 0));
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

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
      .select("*, checklist_items(label, description, position, type)")
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

  // Nomes de quem executou e de quem revisou (aparecem nas telas de revisão/correção).
  const personIds = [task.assigned_to, task.reviewed_by].filter((v): v is string => !!v);
  const { data: people } = personIds.length
    ? await supabase.from("profiles").select("id, name").in("id", personIds)
    : { data: [] as { id: string; name: string }[] };
  const nameOf = (id: string | null) => (id ? (people ?? []).find((p) => p.id === id)?.name ?? null : null);

  const isReviewer = task.status === "em_revisao" && task.reviewed_by === profile.id;
  const isCorrector =
    (task.status === "aguardando_correcao" || task.status === "em_correcao") && task.assigned_to === profile.id;

  // Limpeza adicional ainda sem a 2ª camareira: o checklist só começa depois que ela escolher.
  const waitingSecond =
    task.extra_cleaning && !task.second_assigned_to && (task.status === "pendente" || task.status === "em_andamento");

  const room = (task as unknown as { rooms: { number: string; name: string | null } }).rooms;

  return (
    <div className="space-y-6">
      <BackLink href="/tarefas" />
      <PageHeader
        title={`Suíte ${room.number}`}
        subtitle={`Checklist de ${taskTypeLabel(task.task_type as ChecklistType, task.extra_cleaning).toLowerCase()}`}
      />
      {waitingSecond && task.assigned_to === profile.id ? (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          Esta é uma <strong>limpeza adicional</strong>: ela é feita por duas camareiras. O checklist só começa depois que
          uma segunda camareira escolher este serviço na tela “Minhas suítes”.
        </p>
      ) : isReviewer ? (
        <ReviewPanel
          task={task}
          checks={sortChecksExtrasLast(checks ?? [])}
          occurrences={occurrences}
          categories={categories ?? []}
          executorName={nameOf(task.assigned_to)}
        />
      ) : isCorrector ? (
        <CorrectionPanel
          task={task}
          checks={sortChecksExtrasLast(checks ?? [])}
          minibar={minibar}
          minibarGuestSlot={minibarGuestSlot}
          reviewerName={nameOf(task.reviewed_by)}
        />
      ) : (
        <ChecklistDetail
          task={task}
          checks={sortChecksExtrasLast(checks ?? [])}
          occurrences={occurrences}
          categories={categories ?? []}
          minibar={minibar}
          minibarGuestSlot={minibarGuestSlot}
        />
      )}
    </div>
  );
}

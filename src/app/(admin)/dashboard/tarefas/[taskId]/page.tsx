import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/back-link";
import { taskTypeLabel } from "@/lib/task-type";
import { formatDatePt, formatTimePt, formatDurationPt, effectiveServiceStart } from "@/lib/date";
import type { ChecklistType, DailyRoomTaskOccurrence } from "@/lib/types";
import { ChecklistDetail } from "@/components/shared/checklist-detail";
import { Card, CardContent } from "@/components/ui/card";
import { TASK_STATUS_LABELS } from "@/lib/types";
import { signOccurrencePhotoUrls } from "@/lib/occurrence-photos";

// Visão somente-leitura do admin de um serviço já concluído (ou cancelado)
// pela camareira — mesmo componente ChecklistDetail da tela dela, em modo
// somente leitura. Mostra exatamente o que a camareira registrou naquele
// serviço: checklist, consumo de frigobar DO DIA, ocorrências e observações
// (o bar da piscina não tem relação com o serviço e não aparece aqui).
// Itens da Limpeza adicional vêm depois dos do serviço base (cada grupo na própria ordem).
function sortChecksExtrasLast<T extends { checklist_items?: { type?: string; position?: number } | null }>(rows: T[]): T[] {
  const extra = (r: T) => (r.checklist_items?.type === "limpeza_adicional" ? 1 : 0);
  return [...rows].sort((a, b) => extra(a) - extra(b) || (a.checklist_items?.position ?? 0) - (b.checklist_items?.position ?? 0));
}

export default async function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("daily_room_tasks")
    .select("*, rooms(number, name), profiles!daily_room_tasks_assigned_to_fkey(name), second:profiles!daily_room_tasks_second_assigned_to_fkey(name), reviewer:profiles!daily_room_tasks_reviewed_by_fkey(name)")
    .eq("id", taskId)
    .single();

  if (!task) notFound();

  const [{ data: checks }, { data: occurrencesRaw }, { data: categories }, { data: minibarRaw }] = await Promise.all([
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
    supabase
      .from("daily_room_task_minibar_items")
      .select("id, quantity, minibar_item_id, minibar_items(name)")
      .eq("task_id", taskId),
  ]);
  const taskMinibar = ((minibarRaw ?? []) as unknown as { id: string; quantity: number; minibar_item_id: string; minibar_items: { name: string } | null }[])
    .map((r) => ({ id: r.id, itemId: r.minibar_item_id, name: r.minibar_items?.name ?? "—", quantity: r.quantity }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
  const firstName = (task as unknown as { profiles: { name: string } | null }).profiles?.name ?? "—";
  const secondName = (task as unknown as { second: { name: string } | null }).second?.name ?? null;
  const camareiraName = secondName ? firstName + " e " + secondName : firstName;

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl text-primary">{`Suíte ${room.number} — ${formatDatePt(task.date)}`}</h1>
        {/* Um ponto (≈1,3 px) menor que o título. */}
        <p className="font-heading text-[22.7px] sm:text-[28.7px] leading-tight mt-1">
          {`Checklist de ${taskTypeLabel(task.task_type as ChecklistType, task.extra_cleaning).toLowerCase()} · ${camareiraName}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Início {time(effectiveServiceStart(task.claimed_at, task.started_at))} · Fim {time(task.finished_at)} · Duração{" "}
          {formatDurationPt(effectiveServiceStart(task.claimed_at, task.started_at), task.finished_at)}
        </p>
      </div>
      {hasReview && (
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading text-lg">Revisão e correção</h3>
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
        checks={sortChecksExtrasLast(checks ?? [])}
        occurrences={occurrences}
        categories={categories ?? []}
        taskMinibar={taskMinibar}
        readOnly
      />
    </div>
  );
}

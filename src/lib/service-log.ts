import type { createClient } from "@/lib/supabase/server";
import type { ChecklistType } from "@/lib/types";
import type { ServiceLogRow } from "@/app/(admin)/dashboard/service-log-table";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Serviços CONCLUÍDOS (ciclo inteiro: execução + revisão + correção) num intervalo
// de datas, com os horários de revisão e correção. Usada pelo Resumo executivo
// (últimos 7 dias) e pelo Histórico (período escolhido).
export async function getServiceLogRows(supabase: Supabase, from: string, to: string): Promise<ServiceLogRow[]> {
  const { data } = await supabase
    .from("daily_room_tasks")
    .select(
      "id, date, task_type, claimed_at, started_at, finished_at, review_claimed_at, review_finished_at, review_waived_by, correction_started_at, correction_finished_at, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name), reviewer:profiles!daily_room_tasks_reviewed_by_fkey(name)"
    )
    .gte("date", from)
    .lte("date", to)
    .eq("status", "concluido");

  return (
    (data ?? []) as unknown as {
      id: string;
      date: string;
      task_type: ChecklistType;
      claimed_at: string | null;
      started_at: string | null;
      finished_at: string | null;
      review_claimed_at: string | null;
      review_finished_at: string | null;
      review_waived_by: string | null;
      correction_started_at: string | null;
      correction_finished_at: string | null;
      rooms: { number: string };
      profiles: { name: string } | null;
      reviewer: { name: string } | null;
    }[]
  )
    .map((r) => ({
      id: r.id,
      date: r.date,
      room_number: r.rooms.number,
      task_type: r.task_type,
      claimed_at: r.claimed_at,
      started_at: r.started_at,
      finished_at: r.finished_at,
      camareira_name: r.profiles?.name ?? null,
      reviewer_name: r.reviewer?.name ?? null,
      review_waived: !!r.review_waived_by,
      review_claimed_at: r.review_claimed_at,
      review_finished_at: r.review_finished_at,
      correction_started_at: r.correction_started_at,
      correction_finished_at: r.correction_finished_at,
    }))
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : Number(a.room_number) - Number(b.room_number)));
}

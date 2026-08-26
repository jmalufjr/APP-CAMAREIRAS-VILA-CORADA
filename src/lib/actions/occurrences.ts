"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ChecklistType, OccurrenceStatus } from "@/lib/types";

export interface OccurrenceRow {
  id: string;
  description: string | null;
  status: OccurrenceStatus;
  created_at: string;
  selected_by: string | null;
  selected_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  occurrence_categories: { name: string } | null;
  selected_by_profile: { name: string } | null;
  resolved_by_profile: { name: string } | null;
}

export interface DayTaskRow {
  id: string;
  date: string;
  task_type: ChecklistType;
  notes: string | null;
  rooms: { number: string } | null;
  profiles: { name: string } | null;
  daily_room_task_occurrences: OccurrenceRow[];
}

const OCCURRENCE_SELECT =
  "id, description, status, created_at, selected_by, selected_at, resolved_by, resolved_at, occurrence_categories(name), selected_by_profile:profiles!daily_room_task_occurrences_selected_by_fkey(name), resolved_by_profile:profiles!daily_room_task_occurrences_resolved_by_fkey(name)";

export async function getOccurrencesForDates(dates: string[]): Promise<DayTaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_room_tasks")
    .select(
      `id, date, task_type, notes, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name), daily_room_task_occurrences(${OCCURRENCE_SELECT})`
    )
    .in("date", dates)
    .order("date", { ascending: false });

  const rows = (data ?? []) as unknown as DayTaskRow[];
  return rows.filter((t) => t.notes || (t.daily_room_task_occurrences?.length ?? 0) > 0);
}

export interface ManutencaoOccurrenceRow extends OccurrenceRow {
  daily_room_task_id: string;
  task_date: string;
  task_type: ChecklistType;
  room_number: string;
  camareira_name: string;
}

// Ocorrências visíveis para o funcionário de manutenção: hoje/ontem + qualquer
// ocorrência mais antiga que ainda não foi resolvida (a RLS já garante esse filtro).
export async function getManutencaoOccurrences(): Promise<ManutencaoOccurrenceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_room_task_occurrences")
    .select(
      `${OCCURRENCE_SELECT}, daily_room_tasks!inner(id, date, task_type, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name))`
    )
    .order("created_at", { ascending: false });

  type Raw = OccurrenceRow & {
    daily_room_tasks: {
      id: string;
      date: string;
      task_type: ChecklistType;
      rooms: { number: string } | null;
      profiles: { name: string } | null;
    };
  };

  return ((data ?? []) as unknown as Raw[]).map((o) => ({
    ...o,
    daily_room_task_id: o.daily_room_tasks.id,
    task_date: o.daily_room_tasks.date,
    task_type: o.daily_room_tasks.task_type,
    room_number: o.daily_room_tasks.rooms?.number ?? "—",
    camareira_name: o.daily_room_tasks.profiles?.name ?? "—",
  }));
}

export async function selectOccurrence(occurrenceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("daily_room_task_occurrences")
    .update({ status: "selecionada", selected_by: user.id, selected_at: new Date().toISOString() })
    .eq("id", occurrenceId)
    .eq("status", "pendente");

  if (error) return { error: error.message };
  revalidatePath("/manutencao/ocorrencias");
  revalidatePath("/ocorrencias");
  return { success: true };
}

export async function resolveOccurrence(occurrenceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("daily_room_task_occurrences")
    .update({ status: "resolvida", resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", occurrenceId)
    .eq("selected_by", user.id);

  if (error) return { error: error.message };
  revalidatePath("/manutencao/ocorrencias");
  revalidatePath("/ocorrencias");
  revalidatePath("/ocorrencias/historico");
  revalidatePath("/historico");
  return { success: true };
}

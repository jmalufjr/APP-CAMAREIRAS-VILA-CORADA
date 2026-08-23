import { createClient } from "@/lib/supabase/server";
import type { ChecklistType } from "@/lib/types";

export interface OccurrenceRow {
  id: string;
  description: string | null;
  occurrence_categories: { name: string } | null;
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

export async function getOccurrencesForDates(dates: string[]): Promise<DayTaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_room_tasks")
    .select(
      "id, date, task_type, notes, rooms(number), profiles!daily_room_tasks_assigned_to_fkey(name), daily_room_task_occurrences(id, description, occurrence_categories(name))"
    )
    .in("date", dates)
    .order("date", { ascending: false });

  const rows = (data ?? []) as unknown as DayTaskRow[];
  return rows.filter((t) => t.notes || (t.daily_room_task_occurrences?.length ?? 0) > 0);
}

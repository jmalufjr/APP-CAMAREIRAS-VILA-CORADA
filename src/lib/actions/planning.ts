"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ChecklistType } from "@/lib/types";

export async function setRoomTask(date: string, roomId: string, taskType: ChecklistType | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Remove qualquer tarefa existente do quarto no dia (arrumação e preparação são mutuamente exclusivas)
  await supabase.from("daily_room_tasks").delete().eq("date", date).eq("room_id", roomId);

  if (!taskType) {
    revalidatePath("/planejamento");
    revalidatePath("/tarefas");
    return { success: true };
  }

  // A camareira escolhe o quarto depois; a tarefa nasce sem responsável.
  const { data: task, error } = await supabase
    .from("daily_room_tasks")
    .insert({
      date,
      room_id: roomId,
      task_type: taskType,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error || !task) return { error: error?.message ?? "Erro ao salvar tarefa." };

  const { data: items } = await supabase
    .from("room_checklist_items")
    .select("checklist_item_id, checklist_items!inner(type, active)")
    .eq("room_id", roomId)
    .eq("checklist_items.type", taskType)
    .eq("checklist_items.active", true);

  if (items && items.length > 0) {
    await supabase.from("daily_room_task_checks").insert(
      items.map((i) => ({ daily_room_task_id: task.id, checklist_item_id: i.checklist_item_id }))
    );
  }

  revalidatePath("/planejamento");
  revalidatePath("/tarefas");
  return { success: true };
}

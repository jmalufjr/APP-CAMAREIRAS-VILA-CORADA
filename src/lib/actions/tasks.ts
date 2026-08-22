"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function claimTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  // Só reivindica se ainda não houver responsável (evita duas camareiras pegarem o mesmo quarto).
  const { data, error } = await supabase
    .from("daily_room_tasks")
    .update({ assigned_to: user.id })
    .eq("id", taskId)
    .is("assigned_to", null)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Este quarto já foi escolhido por outra camareira." };

  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  return { success: true };
}

export async function toggleCheck(checkId: string, checked: boolean) {
  const supabase = await createClient();
  const { data: check } = await supabase
    .from("daily_room_task_checks")
    .select("daily_room_task_id")
    .eq("id", checkId)
    .single();

  const { error } = await supabase
    .from("daily_room_task_checks")
    .update({ checked, checked_at: checked ? new Date().toISOString() : null })
    .eq("id", checkId);

  if (error) return { error: error.message };

  if (check) {
    await supabase
      .from("daily_room_tasks")
      .update({ status: "em_andamento" })
      .eq("id", check.daily_room_task_id)
      .eq("status", "pendente");

    await supabase
      .from("daily_room_tasks")
      .update({ started_at: new Date().toISOString() })
      .eq("id", check.daily_room_task_id)
      .is("started_at", null);
  }

  revalidatePath("/tarefas", "layout");
  return { success: true };
}

export async function addOccurrence(taskId: string, categoryId: string, description: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_room_task_occurrences")
    .insert({ daily_room_task_id: taskId, occurrence_category_id: categoryId, description });
  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  return { success: true };
}

export async function removeOccurrence(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("daily_room_task_occurrences").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  return { success: true };
}

export async function releaseTask(taskId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_room_tasks")
    .update({
      status: "concluido",
      finished_at: new Date().toISOString(),
      released_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
  return { success: true };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OCCURRENCE_PHOTOS_BUCKET } from "@/lib/occurrence-photos";
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
    .update({ assigned_to: user.id, claimed_at: new Date().toISOString() })
    .eq("id", taskId)
    .is("assigned_to", null)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Esta suíte já foi escolhida por outra camareira." };

  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  return { success: true };
}

export async function cancelTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_daily_room_task", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  revalidatePath("/dashboard");
  return { success: true };
}

// Cancela a própria escolha de uma suíte já reivindicada (antes de
// finalizar): a suíte volta pra lista de disponíveis, com tudo que foi
// preenchido nessa reivindicação apagado (ver cancel_own_claimed_task).
// Não confundir com cancelTask acima, que cancela um serviço pendente
// ainda não reivindicado por ninguém.
export async function unclaimTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_own_claimed_task", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  return { success: true };
}

export async function toggleCheck(checkId: string, checked: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_daily_room_task_check", {
    p_check_id: checkId,
    p_checked: checked,
  });

  if (error) return { error: error.message };

  revalidatePath("/tarefas", "layout");
  return { success: true };
}

export async function addOccurrence(taskId: string, categoryId: string, description: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_room_task_occurrences")
    .insert({ daily_room_task_id: taskId, occurrence_category_id: categoryId, description: description || null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  return { success: true, occurrenceId: data.id as string };
}

export async function removeOccurrence(id: string) {
  const supabase = await createClient();
  // Busca os caminhos das fotos antes de apagar a ocorrência (o delete em
  // cascata some com os registros no banco, mas não com os arquivos no
  // armazenamento — isso é feito aqui, à parte, via client admin).
  const { data: photos } = await supabase
    .from("daily_room_task_occurrence_photos")
    .select("storage_path")
    .eq("occurrence_id", id);

  const { error } = await supabase.from("daily_room_task_occurrences").delete().eq("id", id);
  if (error) return { error: error.message };

  if (photos && photos.length > 0) {
    const admin = createAdminClient();
    await admin.storage.from(OCCURRENCE_PHOTOS_BUCKET).remove(photos.map((p) => p.storage_path));
  }

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

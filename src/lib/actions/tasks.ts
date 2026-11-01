"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OCCURRENCE_PHOTOS_BUCKET } from "@/lib/occurrence-photos";
import { revalidatePath } from "next/cache";
import { setMinibarConsumption } from "@/lib/actions/minibar";
import type { RoomBillGuestSlot } from "@/lib/types";

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

// A executora libera a suíte: o serviço NÃO fica concluído, vai pra revisão
// (ver release_daily_room_task / PRD_camareira_revisora.md).
export async function releaseTask(taskId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_daily_room_task", { p_task_id: taskId, p_notes: notes });
  if (error) return { error: error.message };
  revalidateTaskPages();
  return { success: true };
}

function revalidateTaskPages() {
  revalidatePath("/tarefas", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/historico");
  revalidatePath("/planejamento");
}

// ---------- Revisão (camareira revisora) ----------

export async function claimReview(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_review", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidateTaskPages();
  return { success: true };
}

export async function releaseReview(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_review", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidateTaskPages();
  return { success: true };
}

export async function setReviewCheckResult(checkId: string, result: "completo" | "incompleto" | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_check_result", { p_check_id: checkId, p_result: result });
  if (error) return { error: error.message };
  return { success: true };
}

export async function setReviewMinibarResult(taskId: string, result: "completo" | "incompleto" | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_minibar_result", { p_task_id: taskId, p_result: result });
  if (error) return { error: error.message };
  return { success: true };
}

// Devolve pra onde o serviço foi: "concluido" (tudo completo) ou
// "aguardando_correcao" (algum item incompleto).
export async function finishReview(taskId: string, notes: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_review", { p_task_id: taskId, p_notes: notes });
  if (error) return { error: error.message };
  revalidateTaskPages();
  return { success: true, outcome: data as string };
}

// ---------- Correção (executora) ----------

export async function startCorrection(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_correction", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidateTaskPages();
  return { success: true };
}

export async function setCorrectionCheck(checkId: string, corrected: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_correction_check", { p_check_id: checkId, p_corrected: corrected });
  if (error) return { error: error.message };
  return { success: true };
}

export async function setCorrectionMinibarDone(taskId: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_correction_minibar_done", { p_task_id: taskId, p_done: done });
  if (error) return { error: error.message };
  return { success: true };
}

// Finaliza a correção. Se o frigobar estava incompleto, os valores
// conferidos/editados pela executora (minibarChanges) só são gravados AGORA —
// e só se a conta da suíte ainda aceitar lançamento; com a conta fechada/paga
// o consumo não é alterado e o aviso volta pra tela (o admin ajusta depois).
export async function finishCorrection(
  taskId: string,
  roomId: string,
  guestSlot: RoomBillGuestSlot,
  minibarChanges: { itemId: string; quantity: number }[]
) {
  const supabase = await createClient();
  let warning: string | null = null;
  for (const change of minibarChanges) {
    const result = await setMinibarConsumption(roomId, change.itemId, change.quantity, guestSlot);
    if (result?.error) {
      warning = "A conta de frigobar desta suíte já está fechada ou paga — o consumo não foi alterado. Avise o administrador para ajustar.";
      break;
    }
  }
  const { error } = await supabase.rpc("finish_correction", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidateTaskPages();
  return { success: true, warning };
}

// ---------- Admin / gerente ----------

export async function waiveReview(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("waive_review", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidateTaskPages();
  return { success: true };
}

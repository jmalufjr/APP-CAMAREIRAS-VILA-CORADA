"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OCCURRENCE_PHOTOS_BUCKET } from "@/lib/occurrence-photos";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncStaysPlanning } from "@/lib/actions/stays-sync";
import { findLastNightOccupant, ensureBillForOccupant, hasPaidBillOnly } from "@/lib/room-occupancy";

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

// Depois de uma troca deixar de ser feita (cancelada, recusada) ou ser antecipada, o serviço dos
// próximos dias da suíte precisa ser recalculado. Roda depois de responder à camareira (sem
// deixá-la esperando) e respeita tudo o que o admin travou.
function recalculatePlanningAfterResponse() {
  after(async () => {
    try {
      await syncStaysPlanning();
    } catch {
      // melhor esforço: a sincronização diária refaz o cálculo de qualquer forma
    }
  });
}

export async function cancelTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_daily_room_task", { p_task_id: taskId });
  if (error) return { error: error.message };
  recalculatePlanningAfterResponse();
  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  revalidatePath("/dashboard");
  return { success: true };
}

// A camareira informa que o hóspede não quis o serviço (arrumação ou troca). O serviço fica
// cancelado e, se era uma troca, o próximo serviço da suíte passa a contemplar a troca.
export async function declineServiceByGuest(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_service_by_guest", { p_task_id: taskId });
  if (error) return { error: error.message };
  recalculatePlanningAfterResponse();
  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  revalidatePath("/dashboard");
  return { success: true };
}

// O hóspede não quis o serviço, mas HAVERÁ reposição de frigobar: o serviço segue para uma tela sem
// checklist (só frigobar, ocorrências e observações) e termina como "não realizado a pedido, com reposição".
export async function declineServiceWithRestock(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_service_with_restock", { p_task_id: taskId });
  if (error) return { error: error.message };
  recalculatePlanningAfterResponse();
  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  return { success: true };
}

// Arrumação: marca que houve troca de roupa de cama e banho a pedido do hóspede (antecipa a troca).
export async function setBedlinenChanged(taskId: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_task_bedlinen_changed", { p_task_id: taskId, p_value: value });
  if (error) return { error: error.message };
  recalculatePlanningAfterResponse();
  revalidatePath("/planejamento");
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

// Limpeza adicional: a 2ª camareira escolhe o serviço (a 1ª já escolheu). Só então ele pode começar;
// o horário de início passa a ser o desta escolha. O checklist continua só com a 1ª camareira.
export async function claimExtraCleaningSecond(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_extra_cleaning_second", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  revalidatePath("/planejamento");
  return { success: true };
}

// "Começar": abre o checklist e grava o horário de início (só na primeira vez — cliques
// seguintes não mudam o horário). É a única coisa gravada antes de finalizar o serviço.
export async function startTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_daily_room_task", { p_task_id: taskId });
  if (error) return { error: error.message };
  revalidatePath("/tarefas", "layout");
  return { success: true };
}

export interface FinalizeServiceInput {
  taskId: string;
  checkedIds: string[];
  notes: string;
  bedlinenChanged: boolean;
  occurrences: { categoryId: string; description: string }[];
  // Consumo de frigobar DO DIA (diferencial): só itens com quantidade > 0.
  minibar: { itemId: string; quantity: number }[];
}

// "Serviço na suíte finalizado": grava de uma vez só tudo o que a camareira preencheu (itens do
// checklist, troca de roupa a pedido, ocorrências, consumo diferencial de frigobar, observações) e
// libera a suíte. Se qualquer parte falhar, nada fica gravado. O consumo de frigobar é SOMADO à conta
// de quem dormiu na suíte na noite anterior (nunca à de quem chega depois).
export async function finalizeService(input: FinalizeServiceInput) {
  const supabase = await createClient();
  const minibar = input.minibar.filter((m) => m.quantity > 0);

  let billId: string | null = null;
  if (minibar.length > 0) {
    const { data: task } = await supabase
      .from("daily_room_tasks")
      .select("room_id, date")
      .eq("id", input.taskId)
      .single();
    if (!task) return { error: "Serviço não encontrado." };
    const occupant = await findLastNightOccupant(supabase, task.room_id as string, task.date as string);
    if (!occupant) {
      return {
        error:
          "Não foi possível identificar o hóspede que dormiu nesta suíte na noite anterior para lançar o frigobar. Tente novamente em instantes ou avise o administrador.",
      };
    }
    if (await hasPaidBillOnly(supabase, task.room_id as string, occupant)) {
      return {
        error:
          "A conta deste hóspede já foi paga: o consumo de frigobar não pode mais ser lançado. Desligue “Houve consumo de frigobar?” e, se quiser, registre nas observações.",
      };
    }
    try {
      billId = (await ensureBillForOccupant(supabase, task.room_id as string, occupant)).id;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao obter a conta do hóspede." };
    }
  }

  const { data, error } = await supabase.rpc("finalize_daily_room_task", {
    p_task_id: input.taskId,
    p_checked_ids: input.checkedIds,
    p_notes: input.notes,
    p_bedlinen: input.bedlinenChanged,
    p_occurrences: input.occurrences.map((o) => ({ category_id: o.categoryId, description: o.description })),
    p_minibar: minibar.map((m) => ({ item_id: m.itemId, quantity: Math.floor(m.quantity) })),
    p_bill_id: billId,
  });
  if (error) return { error: error.message };

  if (input.bedlinenChanged) recalculatePlanningAfterResponse();
  revalidateTaskPages();
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  const occurrenceIds = ((data as { occurrence_ids?: string[] } | null)?.occurrence_ids ?? []) as string[];
  return { success: true, occurrenceIds };
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

// Finaliza a correção. Se o frigobar estava incompleto, os valores do DIA (consumo diferencial que a
// executora lançou) que ela corrigiu só são gravados AGORA: a conta do hóspede é ajustada pela diferença
// (novo valor do dia − valor antigo do dia). Com a conta fechada/paga nada é alterado e o aviso volta pra
// tela (o admin ajusta depois).
export async function finishCorrection(
  taskId: string,
  billId: string | null,
  minibarChanges: { itemId: string; quantity: number }[]
) {
  const supabase = await createClient();
  let warning: string | null = null;
  if (minibarChanges.length > 0) {
    const { error: mbError } = await supabase.rpc("apply_correction_minibar", {
      p_task_id: taskId,
      p_bill_id: billId,
      p_changes: minibarChanges.map((c) => ({ item_id: c.itemId, quantity: Math.max(0, Math.floor(c.quantity)) })),
    });
    if (mbError) {
      warning = "A conta de frigobar desta suíte já está fechada ou paga — o consumo não foi alterado. Avise o administrador para ajustar.";
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

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ChecklistType } from "@/lib/types";

// Reordena todos os itens de `type` de acordo com `orderedIds`, o array
// completo de ids já na ordem final desejada. Usado tanto na criação (item
// novo inserido na posição escolhida) quanto na edição (item existente
// movido de posição).
async function reorderChecklistItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: ChecklistType,
  orderedIds: string[]
) {
  const { error } = await supabase.rpc("reorder_checklist_items", { p_type: type, p_ordered_ids: orderedIds });
  return error;
}

// Lê a posição desejada (1-indexed) do formulário e monta a lista final de
// ids na ordem correta, inserindo/movendo `itemId` para o índice escolhido
// entre os demais itens de `type` (na ordem atual, excluindo `itemId`).
async function buildReorderedIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: ChecklistType,
  itemId: string,
  desiredPosition: number
) {
  const { data: existing } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("type", type)
    .order("position", { ascending: true });

  const ids = (existing ?? []).map((i) => i.id).filter((id) => id !== itemId);
  const targetIndex = Number.isFinite(desiredPosition)
    ? Math.min(Math.max(desiredPosition - 1, 0), ids.length)
    : ids.length;
  ids.splice(targetIndex, 0, itemId);
  return ids;
}

export async function createChecklistItem(formData: FormData) {
  const type = String(formData.get("type") ?? "arrumacao") as ChecklistType;
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const roomIds = formData.getAll("room_ids").map(String);
  const desiredPosition = Number(formData.get("position"));
  if (!label) return { error: "Informe o texto do item." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("checklist_items")
    .select("position")
    .eq("type", type)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { data: item, error } = await supabase
    .from("checklist_items")
    .insert({ type, label, description, position: (max?.position ?? 0) + 1 })
    .select()
    .single();

  if (error || !item) return { error: error?.message ?? "Erro ao criar item." };

  const rooms = roomIds.length > 0 ? roomIds : (await supabase.from("rooms").select("id")).data?.map((r) => r.id) ?? [];
  if (rooms.length > 0) {
    await supabase
      .from("room_checklist_items")
      .insert(rooms.map((room_id) => ({ room_id, checklist_item_id: item.id, position: item.position })));

    // Retroalimenta as tarefas já criadas (hoje/amanhã) e ainda não
    // concluídas dos quartos selecionados, para que o item novo apareça na
    // tela da camareira sem precisar recriar a tarefa do dia.
    const { data: openTasks } = await supabase
      .from("daily_room_tasks")
      .select("id")
      .eq("task_type", type)
      .in("room_id", rooms)
      .neq("status", "concluido");

    if (openTasks && openTasks.length > 0) {
      await supabase.from("daily_room_task_checks").insert(
        openTasks.map((t) => ({ daily_room_task_id: t.id, checklist_item_id: item.id }))
      );
    }
  }

  const orderedIds = await buildReorderedIds(supabase, type, item.id, desiredPosition);
  const reorderError = await reorderChecklistItems(supabase, type, orderedIds);
  if (reorderError) return { error: reorderError.message };

  revalidatePath("/checklists");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function updateChecklistItem(id: string, formData: FormData) {
  const type = String(formData.get("type") ?? "") as ChecklistType;
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const roomIds = formData.getAll("room_ids").map(String);
  const desiredPosition = Number(formData.get("position"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_items")
    .update({ label, description, active })
    .eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("room_checklist_items").delete().eq("checklist_item_id", id);
  if (roomIds.length > 0) {
    await supabase
      .from("room_checklist_items")
      .insert(roomIds.map((room_id) => ({ room_id, checklist_item_id: id, position: 0 })));
  }

  if (type && Number.isFinite(desiredPosition)) {
    const orderedIds = await buildReorderedIds(supabase, type, id, desiredPosition);
    const reorderError = await reorderChecklistItems(supabase, type, orderedIds);
    if (reorderError) return { error: reorderError.message };
  }

  revalidatePath("/checklists");
  return { success: true };
}

export async function deleteChecklistItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

export async function createOccurrenceCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("occurrence_categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase
    .from("occurrence_categories")
    .insert({ name, position: (max?.position ?? 0) + 1 });

  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

export async function updateOccurrenceCategory(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("occurrence_categories")
    .update({ name, active })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

export async function deleteOccurrenceCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("occurrence_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

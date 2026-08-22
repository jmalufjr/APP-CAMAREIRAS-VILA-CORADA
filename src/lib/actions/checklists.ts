"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ChecklistType } from "@/lib/types";

export async function createChecklistItem(formData: FormData) {
  const type = String(formData.get("type") ?? "arrumacao") as ChecklistType;
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const roomIds = formData.getAll("room_ids").map(String);
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
  }

  revalidatePath("/checklists");
  return { success: true };
}

export async function updateChecklistItem(id: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const roomIds = formData.getAll("room_ids").map(String);

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

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/chegadas-saidas/gerenciar");
  revalidatePath("/chegadas-saidas");
}

export async function createArrival(date: string, formData: FormData) {
  const room_id = String(formData.get("room_id") ?? "");
  const guest_name = String(formData.get("guest_name") ?? "").trim();
  const expected_time = String(formData.get("expected_time") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!room_id || !guest_name) return { error: "Selecione o quarto e informe o nome do hóspede." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_arrivals")
    .insert({ date, room_id, guest_name, expected_time, notes });

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma chegada cadastrada para este quarto nesta data. Edite-a." };
    }
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function updateArrival(id: string, formData: FormData) {
  const guest_name = String(formData.get("guest_name") ?? "").trim();
  const expected_time = String(formData.get("expected_time") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!guest_name) return { error: "Informe o nome do hóspede." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_arrivals")
    .update({ guest_name, expected_time, notes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteArrival(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("daily_arrivals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function createDeparture(date: string, formData: FormData) {
  const room_id = String(formData.get("room_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!room_id) return { error: "Selecione o quarto." };

  const supabase = await createClient();
  const { error } = await supabase.from("daily_departures").insert({ date, room_id, notes });

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma saída cadastrada para este quarto nesta data. Edite-a." };
    }
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function updateDeparture(id: string, formData: FormData) {
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_departures")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteDeparture(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("daily_departures").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

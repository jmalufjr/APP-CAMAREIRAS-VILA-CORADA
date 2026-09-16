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
  const nightsRaw = String(formData.get("nights") ?? "").trim();
  const guestCountRaw = String(formData.get("guest_count") ?? "").trim();
  const nights = nightsRaw ? Number(nightsRaw) : null;
  const guest_count = guestCountRaw ? Number(guestCountRaw) : null;

  if (!room_id || !guest_name) return { error: "Selecione a suíte e informe o nome do hóspede." };

  const supabase = await createClient();
  // Cadastro manual (fora da sincronização com a Stays): passa a ter
  // preferência sobre a sincronização para essa suíte/dia (ver
  // PRD_regrasdenegocio.md seção 1).
  const { error } = await supabase
    .from("daily_arrivals")
    .insert({ date, room_id, guest_name, expected_time, notes, nights, guest_count, stays_locked: true });

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma chegada cadastrada para esta suíte nesta data. Edite-a." };
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
  const nightsRaw = String(formData.get("nights") ?? "").trim();
  const guestCountRaw = String(formData.get("guest_count") ?? "").trim();
  const nights = nightsRaw ? Number(nightsRaw) : null;
  const guest_count = guestCountRaw ? Number(guestCountRaw) : null;

  if (!guest_name) return { error: "Informe o nome do hóspede." };

  const supabase = await createClient();

  // "Horário previsto" e "observações" nunca travam a sincronização (ver
  // PRD_regrasdenegocio.md seção 3) — só travar quando algum campo
  // sincronizável (nome, noites, hóspedes) realmente mudou.
  const { data: existing } = await supabase
    .from("daily_arrivals")
    .select("guest_name, nights, guest_count, stays_locked")
    .eq("id", id)
    .single();

  const changedSyncedField =
    existing && (existing.guest_name !== guest_name || existing.nights !== nights || existing.guest_count !== guest_count);

  const { error } = await supabase
    .from("daily_arrivals")
    .update({
      guest_name,
      expected_time,
      notes,
      nights,
      guest_count,
      updated_at: new Date().toISOString(),
      stays_locked: changedSyncedField ? true : existing?.stays_locked ?? true,
    })
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

  if (!room_id) return { error: "Selecione a suíte." };

  const supabase = await createClient();
  // Cadastro manual: passa a ter preferência sobre a sincronização para
  // essa suíte/dia (ver PRD_regrasdenegocio.md seção 1).
  const { error } = await supabase.from("daily_departures").insert({ date, room_id, notes, stays_locked: true });

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma saída cadastrada para esta suíte nesta data. Edite-a." };
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

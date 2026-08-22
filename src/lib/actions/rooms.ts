"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createRoom(formData: FormData) {
  const number = String(formData.get("number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || null;
  if (!number) return { error: "Informe o número do quarto." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("rooms")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase
    .from("rooms")
    .insert({ number, name, position: (max?.position ?? 0) + 1 });

  if (error) return { error: error.message };
  revalidatePath("/quartos");
  return { success: true };
}

export async function updateRoom(id: string, formData: FormData) {
  const number = String(formData.get("number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update({ number, name, active }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/quartos");
  return { success: true };
}

export async function deleteRoom(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/quartos");
  return { success: true };
}

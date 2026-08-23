"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createBreakfastTable(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const shape = String(formData.get("shape") ?? "round") as "round" | "rect";
  const seats = Number(formData.get("seats") ?? 2);
  if (!label) return { error: "Informe o nome da mesa." };

  const supabase = await createClient();
  const { error } = await supabase.from("breakfast_tables").insert({
    label,
    shape,
    seats,
    pos_x: 40,
    pos_y: 40,
    width: shape === "rect" ? 70 : 70,
    height: shape === "rect" ? 200 : 70,
  });

  if (error) return { error: error.message };
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function updateBreakfastTable(id: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const shape = String(formData.get("shape") ?? "round") as "round" | "rect";
  const seats = Number(formData.get("seats") ?? 2);
  const active = formData.get("active") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("breakfast_tables")
    .update({ label, shape, seats, active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function deleteBreakfastTable(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("breakfast_tables").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export interface TablePosition {
  id: string;
  pos_x: number;
  pos_y: number;
}

export async function saveTableLayout(positions: TablePosition[]) {
  const supabase = await createClient();
  await Promise.all(
    positions.map((p) =>
      supabase.from("breakfast_tables").update({ pos_x: p.pos_x, pos_y: p.pos_y }).eq("id", p.id)
    )
  );
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function setGuestCount(date: string, tableId: string, guestCount: number) {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("commission_settings")
    .select("value_per_table")
    .single();

  const { error } = await supabase.from("daily_breakfast").upsert(
    {
      date,
      table_id: tableId,
      guest_count: guestCount,
      value_per_table_snapshot: settings?.value_per_table ?? 10,
    },
    { onConflict: "date,table_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function setTableNotes(date: string, tableId: string, notes: string) {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("commission_settings")
    .select("value_per_table")
    .single();

  const { error } = await supabase.from("daily_breakfast").upsert(
    {
      date,
      table_id: tableId,
      notes: notes || null,
      value_per_table_snapshot: settings?.value_per_table ?? 10,
    },
    { onConflict: "date,table_id", ignoreDuplicates: false }
  );

  if (error) return { error: error.message };
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function updateCommissionValue(value: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_settings")
    .update({ value_per_table: value, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  revalidatePath("/dashboard");
  return { success: true };
}

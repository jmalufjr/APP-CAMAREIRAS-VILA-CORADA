"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createBreakfastTable(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const shape = String(formData.get("shape") ?? "round") as "round" | "rect" | "square";
  const seats = Number(formData.get("seats") ?? 2);
  if (!label) return { error: "Informe o nome da mesa." };

  // Quadrada usa o mesmo tamanho fixo da redonda (lado = diâmetro): só o
  // retângulo tem uma altura diferente da largura.
  const { width, height } = shape === "rect" ? { width: 70, height: 200 } : { width: 70, height: 70 };

  const supabase = await createClient();
  const { error } = await supabase.from("breakfast_tables").insert({
    label,
    shape,
    seats,
    pos_x: 40,
    pos_y: 40,
    width,
    height,
  });

  if (error) return { error: error.message };
  revalidatePath("/checklists/mesas");
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function updateBreakfastTable(id: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const shape = String(formData.get("shape") ?? "round") as "round" | "rect" | "square";
  const seats = Number(formData.get("seats") ?? 2);
  const active = formData.get("active") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("breakfast_tables")
    .update({ label, shape, seats, active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/checklists/mesas");
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function deleteBreakfastTable(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("breakfast_tables").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists/mesas");
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
  revalidatePath("/checklists/mesas");
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
      stays_locked: true,
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

// Associa uma suíte a uma mesa do café num dia (com sua quantidade de
// hóspedes) — a Mesa 7 pode receber mais de uma suíte (ver
// PRD_regrasdenegocio.md seção 4). Uma suíte só pode estar em uma mesa por
// dia (upsert por date+room_id: escolher a suíte de novo, numa mesa
// diferente, move-a em vez de duplicar).
export async function setTableRoomAssignment(date: string, tableId: string, roomId: string, guestCount: number) {
  const supabase = await createClient();

  // Escolheu uma mesa de verdade: remove a lápide de exclusão, se houver
  // (ver `removeTableRoomAssignment`) — o admin não quer mais excluir essa
  // suíte da distribuição hoje.
  await supabase.from("daily_breakfast_room_exclusions").delete().eq("date", date).eq("room_id", roomId);

  const { error } = await supabase.from("daily_breakfast_room_assignments").upsert(
    {
      date,
      table_id: tableId,
      room_id: roomId,
      guest_count: Math.max(0, Math.floor(guestCount) || 0),
      stays_locked: true,
    },
    { onConflict: "date,room_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function removeTableRoomAssignment(date: string, roomId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("daily_breakfast_room_assignments")
    .delete()
    .eq("date", date)
    .eq("room_id", roomId);

  if (error) return { error: error.message };

  // Remoção de propósito, não só "ainda não alocada": grava uma lápide pra
  // sincronização futura (automática ou manual não forçada) respeitar essa
  // escolha em vez de realocar a suíte em alguma mesa na próxima execução
  // (PRD_regrasdenegocio.md seção 1; ver CLAUDE.md Parte 15).
  const { error: exclusionError } = await supabase
    .from("daily_breakfast_room_exclusions")
    .upsert({ date, room_id: roomId, created_by: user?.id }, { onConflict: "date,room_id", ignoreDuplicates: true });
  if (exclusionError) return { error: exclusionError.message };

  revalidatePath("/mesas/gerenciar");
  revalidatePath("/mesas");
  return { success: true };
}

export async function setBreakfastDaySettings(date: string, totalTables: number, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("daily_breakfast_settings").upsert(
    { date, total_tables: totalTables, notes: notes.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: "date" }
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
  revalidatePath("/mesas/gerenciar");
  revalidatePath("/dashboard");
  return { success: true };
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaysReservationsIncluding, type StaysReservationRaw } from "@/lib/stays/client";
import { deriveWorkType } from "@/lib/stays/derive-planning";
import { todayKey, tomorrowKey } from "@/lib/date";
import { revalidatePath } from "next/cache";

// Sincroniza o Planejamento Diário (hoje + amanhã) com as reservas da
// Stays — ver PRD_regrasdenegocio.md seções 1 e 2. Usa o client
// admin/service-role de propósito: precisa gravar em daily_room_tasks
// independente de sessão de usuário (essencial pra quando isso rodar via
// cron, sem ninguém logado). Só a Server Action que chama esta função é
// exposta pra UI — nenhum componente "use client" importa isto direto.
export async function syncStaysPlanning() {
  const supabase = createAdminClient();
  const dates = [todayKey(), tomorrowKey()];

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id, stays_listing_id")
    .eq("active", true)
    .not("stays_listing_id", "is", null);

  if (roomsError) return { error: roomsError.message };
  if (!rooms || rooms.length === 0) {
    return { error: "Nenhuma suíte com stays_listing_id configurado (ver README.md seção 6.3)." };
  }

  let reservations: StaysReservationRaw[];
  try {
    reservations = await getStaysReservationsIncluding(dates[0], dates[dates.length - 1]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao consultar a API da Stays." };
  }

  const byListing = new Map<string, StaysReservationRaw[]>();
  reservations.forEach((r) => {
    const list = byListing.get(r._idlisting) ?? [];
    list.push(r);
    byListing.set(r._idlisting, list);
  });

  let updated = 0;
  let skipped = 0;

  for (const date of dates) {
    for (const room of rooms as { id: string; stays_listing_id: string }[]) {
      const roomReservations = byListing.get(room.stays_listing_id) ?? [];
      const desiredType = deriveWorkType(roomReservations, date);

      const { data: existing } = await supabase
        .from("daily_room_tasks")
        .select("id, task_type, status, assigned_to, stays_locked")
        .eq("date", date)
        .eq("room_id", room.id)
        .maybeSingle();

      // Preferência do admin (stays_locked), ou quarto já escolhido/em
      // andamento/concluído/cancelado por uma camareira: não mexe.
      if (existing && (existing.stays_locked || existing.assigned_to || existing.status !== "pendente")) {
        skipped++;
        continue;
      }

      if (!desiredType) {
        if (existing) {
          await supabase.from("daily_room_tasks").delete().eq("id", existing.id);
          updated++;
        }
        continue;
      }

      if (existing && existing.task_type === desiredType) continue; // já está certo, não mexe

      if (existing) {
        await supabase.from("daily_room_tasks").delete().eq("id", existing.id);
      }

      const { data: task, error: insertError } = await supabase
        .from("daily_room_tasks")
        .insert({ date, room_id: room.id, task_type: desiredType, stays_locked: false })
        .select()
        .single();
      if (insertError || !task) continue;

      const { data: items } = await supabase
        .from("room_checklist_items")
        .select("checklist_item_id, checklist_items!inner(type, active)")
        .eq("room_id", room.id)
        .eq("checklist_items.type", desiredType)
        .eq("checklist_items.active", true);

      if (items && items.length > 0) {
        await supabase
          .from("daily_room_task_checks")
          .insert(items.map((i) => ({ daily_room_task_id: task.id, checklist_item_id: i.checklist_item_id })));
      }
      updated++;
    }
  }

  revalidatePath("/planejamento");
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  return { success: true, updated, skipped };
}

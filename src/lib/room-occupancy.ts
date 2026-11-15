import type { createClient } from "@/lib/supabase/server";
import { getStaysReservationsIncluding, getStaysClientName } from "@/lib/stays/client";
import { addDaysKey } from "@/lib/date";
import type { RoomBill } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Quem dormiu na suíte na noite anterior a uma data: o trinômio
// (suíte, hóspede, reserva da Stays). É a conta que recebe o consumo de
// frigobar lançado no serviço daquele dia — nunca a de quem chega depois.
export interface RoomOccupant {
  reservationId: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
}

// Regra: check-in antes da data e check-out na data ou depois (mesma regra do café da manhã).
// Primeiro olha a ocupação gravada pela sincronização; se ela ainda não rodou para essa data,
// consulta a Stays na hora (melhor esforço — nunca trava quem não precisa da conta).
export async function findLastNightOccupant(
  supabase: Supabase,
  roomId: string,
  date: string
): Promise<RoomOccupant | null> {
  const { data } = await supabase
    .from("room_night_occupancy")
    .select("stays_reservation_id, guest_name, check_in, check_out")
    .eq("date", date)
    .eq("room_id", roomId)
    .maybeSingle();
  if (data) {
    return {
      reservationId: data.stays_reservation_id as string,
      guestName: (data.guest_name as string | null) ?? null,
      checkIn: (data.check_in as string | null) ?? null,
      checkOut: (data.check_out as string | null) ?? null,
    };
  }

  const { data: room } = await supabase.from("rooms").select("stays_listing_id").eq("id", roomId).single();
  if (!room?.stays_listing_id) return null;
  try {
    const reservations = await getStaysReservationsIncluding(addDaysKey(date, -1), date);
    const r = reservations.find(
      (x) => x._idlisting === room.stays_listing_id && x.checkInDate < date && date <= x.checkOutDate
    );
    if (!r) return null;
    const guestName = await getStaysClientName(r._idclient).catch(() => null);
    return { reservationId: r._id, guestName, checkIn: r.checkInDate, checkOut: r.checkOutDate };
  } catch {
    return null;
  }
}

// Conta não paga da reserva (sem criar).
export async function findBillForOccupant(
  supabase: Supabase,
  roomId: string,
  occupant: RoomOccupant
): Promise<RoomBill | null> {
  const { data } = await supabase
    .from("room_bills")
    .select("*")
    .eq("room_id", roomId)
    .eq("stays_reservation_id", occupant.reservationId)
    .neq("status", "paga")
    .maybeSingle();
  return (data as RoomBill | null) ?? null;
}

// A reserva já tem conta PAGA e nenhuma aberta? Conta paga nunca é reaberta nem recriada: consumo
// identificado depois disso é perda e não pode ser lançado.
export async function hasPaidBillOnly(supabase: Supabase, roomId: string, occupant: RoomOccupant): Promise<boolean> {
  const { data } = await supabase
    .from("room_bills")
    .select("status")
    .eq("room_id", roomId)
    .eq("stays_reservation_id", occupant.reservationId);
  const rows = data ?? [];
  return rows.length > 0 && rows.every((r) => r.status === "paga");
}

// Acha ou cria (sem duplicar) a conta da reserva — via função do banco, porque a camareira
// não pode inserir direto em room_bills.
export async function ensureBillForOccupant(
  supabase: Supabase,
  roomId: string,
  occupant: RoomOccupant
): Promise<RoomBill> {
  const { data, error } = await supabase.rpc("ensure_room_bill_for_reservation", {
    p_room_id: roomId,
    p_reservation_id: occupant.reservationId,
    p_guest_name: occupant.guestName,
    p_check_in: occupant.checkIn,
    p_check_out: occupant.checkOut,
  });
  if (error || !data) throw new Error(error?.message ?? "Erro ao obter a conta do hóspede.");
  return data as RoomBill;
}

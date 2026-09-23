import type { createClient } from "@/lib/supabase/server";
import type { RoomBill, RoomBillGuestSlot } from "@/lib/types";

// Taxa de serviço sobre o consumo do bar da piscina — usada tanto no
// total da conta do quarto (room-bills.ts) quanto no cálculo da comissão
// de 10% por camareira, aplicada por comanda (comandas.ts).
export const SERVICE_CHARGE_RATE = 0.1;

// Não é uma Server Action (recebe o client Supabase como parâmetro, o que
// não é serializável através do boundary "use server") — é um helper
// interno, importado pelos módulos de actions que precisam da conta
// corrente (não-paga) de um quarto, criando-a sob demanda se ainda não
// existir uma (quarto novo). A criação em si passa pela função SQL
// `ensure_room_bill` (security definer) porque a policy de INSERT direto em
// room_bills é admin-only — a camareira também precisa conseguir garantir
// essa conta na primeira vez que lança consumo num quarto sem conta ainda.
export async function getOrCreateCurrentBill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  guestSlot: RoomBillGuestSlot = "unica"
): Promise<RoomBill> {
  const { data, error } = await supabase.rpc("ensure_room_bill", {
    p_room_id: roomId,
    p_guest_slot: guestSlot,
  });
  if (error || !data) throw new Error(error?.message ?? "Erro ao obter a conta do quarto.");
  return data as RoomBill;
}

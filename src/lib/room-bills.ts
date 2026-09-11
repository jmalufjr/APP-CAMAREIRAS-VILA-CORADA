import type { createClient } from "@/lib/supabase/server";
import type { RoomBill } from "@/lib/types";

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
  roomId: string
): Promise<RoomBill> {
  const { data, error } = await supabase.rpc("ensure_room_bill", { p_room_id: roomId });
  if (error || !data) throw new Error(error?.message ?? "Erro ao obter a conta do quarto.");
  return data as RoomBill;
}

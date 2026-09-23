import type { createClient } from "@/lib/supabase/server";
import type { RoomBill, RoomBillGuestSlot } from "@/lib/types";

// Taxa de serviço sobre o consumo do bar da piscina — usada tanto no
// total da conta do quarto (room-bills.ts) quanto no cálculo da comissão
// de 10% por camareira, aplicada por comanda (comandas.ts).
export const SERVICE_CHARGE_RATE = 0.1;

export interface RoomBillLineItem {
  id: string;
  name: string;
  quantity: number;
  subtotal: number;
}

export type MinibarRow = {
  bill_id: string;
  minibar_item_id: string;
  quantity: number;
  price_snapshot: number;
  minibar_items: { name: string } | null;
};
export type PoolbarRow = {
  quantity: number;
  price_snapshot: number;
  poolbar_item_id: string;
  poolbar_items: { name: string } | null;
  bar_comandas: { bill_id: string; status: string };
};

function sumLines(rows: { id: string; name: string; quantity: number; price_snapshot: number }[]): RoomBillLineItem[] {
  const byId = new Map<string, RoomBillLineItem>();
  rows.forEach((r) => {
    const entry = byId.get(r.id) ?? { id: r.id, name: r.name, quantity: 0, subtotal: 0 };
    entry.quantity += r.quantity;
    entry.subtotal += r.quantity * Number(r.price_snapshot);
    byId.set(r.id, entry);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Não é uma Server Action — função pura, usada tanto por
// src/lib/actions/room-bills.ts (reexportada de lá pra não quebrar quem já
// importa de lá) quanto pela API de consumos
// (src/lib/integration/stay-accounts.ts), sem duplicar a matemática de
// totais em nenhum dos dois lugares.
export function computeBillTotals(billId: string, mbRows: MinibarRow[], pbRows: PoolbarRow[], waived: boolean) {
  const minibarItems = sumLines(
    mbRows
      .filter((r) => r.bill_id === billId)
      .map((r) => ({ id: r.minibar_item_id, name: r.minibar_items?.name ?? "—", quantity: r.quantity, price_snapshot: r.price_snapshot }))
  );
  const poolbarItems = sumLines(
    pbRows
      .filter((r) => r.bar_comandas.bill_id === billId)
      .map((r) => ({ id: r.poolbar_item_id, name: r.poolbar_items?.name ?? "—", quantity: r.quantity, price_snapshot: r.price_snapshot }))
  );
  const minibarTotal = minibarItems.reduce((sum, i) => sum + i.subtotal, 0);
  const poolbarSubtotal = poolbarItems.reduce((sum, i) => sum + i.subtotal, 0);
  const serviceCharge = waived ? 0 : poolbarSubtotal * SERVICE_CHARGE_RATE;
  const poolbarTotalWithCharge = poolbarSubtotal + serviceCharge;
  const grandTotal = minibarTotal + poolbarTotalWithCharge;
  return {
    minibarItems,
    minibarTotal,
    poolbarItems,
    poolbarSubtotal,
    serviceCharge,
    poolbarTotalWithCharge,
    grandTotal,
    serviceChargeWaived: waived,
  };
}

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

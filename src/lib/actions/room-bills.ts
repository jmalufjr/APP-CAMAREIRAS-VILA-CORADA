"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getOrCreateCurrentBill } from "@/lib/room-bills";
import type { RoomBillStatus } from "@/lib/types";

const SERVICE_CHARGE_RATE = 0.1;

export async function closeRoomBill(roomId: string) {
  const supabase = await createClient();
  const bill = await getOrCreateCurrentBill(supabase, roomId);
  if (bill.status === "fechada") return { error: "A conta deste quarto já está fechada." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("room_bills")
    .update({ status: "fechada", closed_at: new Date().toISOString(), closed_by: user?.id })
    .eq("id", bill.id);

  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function reopenRoomBill(roomId: string) {
  const supabase = await createClient();
  const bill = await getOrCreateCurrentBill(supabase, roomId);
  if (bill.status !== "fechada") return { error: "Só é possível reabrir uma conta fechada." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("room_bills")
    .update({ status: "reaberta", reopened_at: new Date().toISOString(), reopened_by: user?.id })
    .eq("id", bill.id);

  if (error) return { error: error.message };
  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function markRoomBillPaid(roomId: string) {
  const supabase = await createClient();
  const bill = await getOrCreateCurrentBill(supabase, roomId);
  if (bill.status !== "fechada") {
    return { error: "Feche a conta antes de registrar o pagamento." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: payError } = await supabase
    .from("room_bills")
    .update({ status: "paga", paid_at: new Date().toISOString(), paid_by: user?.id })
    .eq("id", bill.id);
  if (payError) return { error: payError.message };

  const { error: newBillError } = await supabase
    .from("room_bills")
    .insert({ room_id: roomId, status: "aberta" });
  if (newBillError) return { error: newBillError.message };

  revalidatePath("/frigobar");
  revalidatePath("/bar-piscina");
  revalidatePath("/tarefas");
  return { success: true };
}

// ---------- Leitura combinada para a tela do admin "Consumo de Bar e Frigobar" ----------

export interface RoomBillLineItem {
  id: string;
  name: string;
  quantity: number;
  subtotal: number;
}

export interface RoomBillOverview {
  room_id: string;
  room_number: string;
  bill_id: string;
  status: RoomBillStatus;
  minibarItems: RoomBillLineItem[];
  minibarTotal: number;
  poolbarItems: RoomBillLineItem[];
  poolbarSubtotal: number;
  serviceCharge: number;
  poolbarTotalWithCharge: number;
  grandTotal: number;
  lastPaidBill: { total: number; paid_at: string } | null;
}

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

export async function getRoomBillsOverview(): Promise<RoomBillOverview[]> {
  const supabase = await createClient();
  const [{ data: rooms }, { data: bills }] = await Promise.all([
    supabase.from("rooms").select("id, number").eq("active", true).order("position"),
    supabase.from("room_bills").select("*"),
  ]);

  const roomList = rooms ?? [];
  const allBills = bills ?? [];

  const currentBillByRoom = new Map<string, { id: string; status: RoomBillStatus }>();
  for (const room of roomList) {
    const current = allBills.find((b) => b.room_id === room.id && b.status !== "paga");
    if (current) {
      currentBillByRoom.set(room.id, current);
    } else {
      const created = await getOrCreateCurrentBill(supabase, room.id);
      currentBillByRoom.set(room.id, created);
    }
  }

  const currentBillIds = Array.from(currentBillByRoom.values()).map((b) => b.id);

  const lastPaidByRoom = new Map<string, { id: string; paid_at: string }>();
  allBills
    .filter((b) => b.status === "paga" && b.paid_at)
    .forEach((b) => {
      const existing = lastPaidByRoom.get(b.room_id);
      if (!existing || (b.paid_at as string) > existing.paid_at) {
        lastPaidByRoom.set(b.room_id, { id: b.id, paid_at: b.paid_at as string });
      }
    });
  const lastPaidBillIds = Array.from(lastPaidByRoom.values()).map((b) => b.id);

  const allRelevantBillIds = [...currentBillIds, ...lastPaidBillIds];

  const [{ data: minibarRows }, { data: poolbarRows }] = await Promise.all([
    allRelevantBillIds.length
      ? supabase
          .from("room_bill_minibar_items")
          .select("bill_id, minibar_item_id, quantity, price_snapshot, minibar_items(name)")
          .in("bill_id", allRelevantBillIds)
          .gt("quantity", 0)
      : Promise.resolve({ data: [] as unknown[] }),
    allRelevantBillIds.length
      ? supabase
          .from("room_bill_poolbar_items")
          .select("bill_id, poolbar_item_id, quantity, price_snapshot, poolbar_items(name)")
          .in("bill_id", allRelevantBillIds)
          .gt("quantity", 0)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  type MinibarRow = {
    bill_id: string;
    minibar_item_id: string;
    quantity: number;
    price_snapshot: number;
    minibar_items: { name: string } | null;
  };
  type PoolbarRow = {
    bill_id: string;
    poolbar_item_id: string;
    quantity: number;
    price_snapshot: number;
    poolbar_items: { name: string } | null;
  };
  const mbRows = (minibarRows ?? []) as unknown as MinibarRow[];
  const pbRows = (poolbarRows ?? []) as unknown as PoolbarRow[];

  return roomList.map((room) => {
    const currentBill = currentBillByRoom.get(room.id)!;
    const minibarItems = sumLines(
      mbRows
        .filter((r) => r.bill_id === currentBill.id)
        .map((r) => ({ id: r.minibar_item_id, name: r.minibar_items?.name ?? "—", quantity: r.quantity, price_snapshot: r.price_snapshot }))
    );
    const poolbarItems = sumLines(
      pbRows
        .filter((r) => r.bill_id === currentBill.id)
        .map((r) => ({ id: r.poolbar_item_id, name: r.poolbar_items?.name ?? "—", quantity: r.quantity, price_snapshot: r.price_snapshot }))
    );
    const minibarTotal = minibarItems.reduce((sum, i) => sum + i.subtotal, 0);
    const poolbarSubtotal = poolbarItems.reduce((sum, i) => sum + i.subtotal, 0);
    const serviceCharge = poolbarSubtotal * SERVICE_CHARGE_RATE;
    const poolbarTotalWithCharge = poolbarSubtotal + serviceCharge;
    const grandTotal = minibarTotal + poolbarTotalWithCharge;

    const lastPaid = lastPaidByRoom.get(room.id);
    let lastPaidBill: RoomBillOverview["lastPaidBill"] = null;
    if (lastPaid) {
      const paidMinibarTotal = mbRows
        .filter((r) => r.bill_id === lastPaid.id)
        .reduce((sum, r) => sum + r.quantity * Number(r.price_snapshot), 0);
      const paidPoolbarSubtotal = pbRows
        .filter((r) => r.bill_id === lastPaid.id)
        .reduce((sum, r) => sum + r.quantity * Number(r.price_snapshot), 0);
      const paidTotal = paidMinibarTotal + paidPoolbarSubtotal * (1 + SERVICE_CHARGE_RATE);
      lastPaidBill = { total: paidTotal, paid_at: lastPaid.paid_at };
    }

    return {
      room_id: room.id,
      room_number: room.number,
      bill_id: currentBill.id,
      status: currentBill.status,
      minibarItems,
      minibarTotal,
      poolbarItems,
      poolbarSubtotal,
      serviceCharge,
      poolbarTotalWithCharge,
      grandTotal,
      lastPaidBill,
    };
  });
}

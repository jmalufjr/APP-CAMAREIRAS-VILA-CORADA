"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/estoque", "layout");
  revalidatePath("/manutencao/estoque", "layout");
  revalidatePath("/dashboard");
}

// Baixa manual de um item — qualquer papel logado pode registrar (camareira,
// manutenção ou admin), sempre em nome de quem está logado (ver RLS
// "inv_mov_insert_baixa_manual"). Quantidade sempre positiva aqui; o sinal
// negativo (saída) é aplicado na gravação.
export async function registerStockWithdrawal(inventoryItemId: string, quantity: number, notes?: string) {
  if (quantity <= 0) return { error: "Informe uma quantidade maior que zero." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("inventory_movements").insert({
    inventory_item_id: inventoryItemId,
    movement_type: "baixa_manual",
    quantity: -quantity,
    created_by: user.id,
    notes: notes || null,
  });

  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export interface InventoryMovementRow {
  id: string;
  movement_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
  item_name: string;
}

// Histórico recente de movimentos de um item (ou de todos, se omitido) —
// usado na tela de detalhe do item/relatórios do admin.
export async function getRecentMovements(inventoryItemId?: string, limit = 50): Promise<InventoryMovementRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("inventory_movements")
    .select(
      "id, movement_type, quantity, notes, created_at, created_by_profile:profiles(name), inventory_items(name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (inventoryItemId) query = query.eq("inventory_item_id", inventoryItemId);

  const { data } = await query;
  type Raw = {
    id: string;
    movement_type: string;
    quantity: number;
    notes: string | null;
    created_at: string;
    created_by_profile: { name: string } | null;
    inventory_items: { name: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    movement_type: r.movement_type,
    quantity: r.quantity,
    notes: r.notes,
    created_at: r.created_at,
    created_by_name: r.created_by_profile?.name ?? null,
    item_name: r.inventory_items?.name ?? "—",
  }));
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryItem } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/estoque", "layout");
  revalidatePath("/manutencao/estoque", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/dashboard");
}

export interface InventoryItemWithBalance extends InventoryItem {
  category_name: string;
  balance: number;
}

// Lista o catálogo com o saldo de cada item já calculado (soma de todos
// os movimentos — nunca um número guardado à parte, ver
// PRD_compras.md/schema.sql pro porquê). `onlyActive` filtra os
// desativados (tela de baixa/compra não precisa mostrá-los).
export async function getInventoryItems(onlyActive = true): Promise<InventoryItemWithBalance[]> {
  const supabase = await createClient();
  let query = supabase
    .from("inventory_items")
    .select("*, expense_categories(name)")
    .order("position")
    .order("name");
  if (onlyActive) query = query.eq("active", true);
  const { data } = await query;

  const items = (data ?? []) as unknown as (InventoryItem & { expense_categories: { name: string } | null })[];
  if (items.length === 0) return [];

  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("inventory_item_id, balance")
    .in(
      "inventory_item_id",
      items.map((i) => i.id)
    );
  const balanceMap = new Map((balances ?? []).map((b) => [b.inventory_item_id, Number(b.balance)]));

  return items.map((i) => ({
    ...i,
    category_name: i.expense_categories?.name ?? "—",
    balance: balanceMap.get(i.id) ?? 0,
  }));
}

// Itens com saldo abaixo do ponto de reposição — card "Itens com estoque
// baixo" do Resumo Executivo e lista de apoio na tela de compras.
export async function getLowStockItems(): Promise<InventoryItemWithBalance[]> {
  const items = await getInventoryItems(true);
  return items.filter((i) => i.reorder_point > 0 && i.balance < i.reorder_point);
}

export async function findInventoryItemByBarcode(barcode: string): Promise<InventoryItemWithBalance | null> {
  const items = await getInventoryItems(true);
  return items.find((i) => i.barcode === barcode) ?? null;
}

export async function createInventoryItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "");
  const unit = String(formData.get("unit") ?? "un").trim() || "un";
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  const reorderRaw = String(formData.get("reorder_point") ?? "").trim();
  const reorder_point = reorderRaw ? Number(reorderRaw) : 0;

  if (!name || !category_id) return { error: "Informe o nome e a categoria do item." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ name, category_id, unit, barcode, reorder_point })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Já existe um item com esse código de barras." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true, itemId: data.id as string };
}

export async function updateInventoryItem(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "");
  const unit = String(formData.get("unit") ?? "un").trim() || "un";
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  const reorderRaw = String(formData.get("reorder_point") ?? "").trim();
  const reorder_point = reorderRaw ? Number(reorderRaw) : 0;
  const active = formData.get("active") === "on";

  if (!name || !category_id) return { error: "Informe o nome e a categoria do item." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ name, category_id, unit, barcode, reorder_point, active })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Já existe um item com esse código de barras." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function deleteInventoryItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// Liga/desliga um item de estoque a um item de frigobar/poolbar (baixa
// automática ao pagar a conta — ver PRD_compras.md seção 5.4). Só um dos
// dois por vez (igual à constraint do banco).
export async function linkInventoryItemToCatalog(
  id: string,
  kind: "minibar" | "poolbar" | "none",
  catalogItemId: string | null
) {
  const supabase = await createClient();
  const payload =
    kind === "minibar"
      ? { linked_minibar_item_id: catalogItemId, linked_poolbar_item_id: null }
      : kind === "poolbar"
        ? { linked_minibar_item_id: null, linked_poolbar_item_id: catalogItemId }
        : { linked_minibar_item_id: null, linked_poolbar_item_id: null };

  const { error } = await supabase.from("inventory_items").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

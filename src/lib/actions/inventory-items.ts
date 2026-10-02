"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryItem, InventoryItemRecipe } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/estoque", "layout");
  revalidatePath("/manutencao/estoque", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/pedidos-compra", "layout");
  revalidatePath("/manutencao/pedidos-compra", "layout");
  revalidatePath("/dashboard");
}

export interface InventoryItemWithBalance extends InventoryItem {
  category_name: string;
  turnover_group_name: string | null;
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
    .select("*, expense_categories(name), inventory_turnover_groups(name)")
    .order("position")
    .order("name");
  if (onlyActive) query = query.eq("active", true);
  const { data } = await query;

  type Raw = InventoryItem & {
    expense_categories: { name: string } | null;
    inventory_turnover_groups: { name: string } | null;
  };
  const items = (data ?? []) as unknown as Raw[];
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
    turnover_group_name: i.inventory_turnover_groups?.name ?? null,
    balance: balanceMap.get(i.id) ?? 0,
  }));
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
  const turnover_group_id = String(formData.get("turnover_group_id") ?? "").trim() || null;
  const portionWeightRaw = String(formData.get("portion_weight_kg") ?? "").trim();
  const portion_weight_kg = portionWeightRaw ? Number(portionWeightRaw) : null;

  if (!name || !category_id) return { error: "Informe o nome e a categoria do item." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ name, category_id, unit, barcode, reorder_point, turnover_group_id, portion_weight_kg })
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
  const turnover_group_id = String(formData.get("turnover_group_id") ?? "").trim() || null;
  const portionWeightRaw = String(formData.get("portion_weight_kg") ?? "").trim();
  const portion_weight_kg = portionWeightRaw ? Number(portionWeightRaw) : null;
  const active = formData.get("active") === "on";

  if (!name || !category_id) return { error: "Informe o nome e a categoria do item." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ name, category_id, unit, barcode, reorder_point, turnover_group_id, portion_weight_kg, active })
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

// ---------- Ficha técnica (receita): ingrediente(s) por produto do cardápio ----------

export interface InventoryItemRecipeView extends InventoryItemRecipe {
  catalog_name: string;
  catalog_kind: "minibar" | "poolbar";
}

type RecipeRaw = InventoryItemRecipe & {
  minibar_items: { name: string } | null;
  poolbar_items: { name: string } | null;
};

function mapRecipeRow(r: RecipeRaw): InventoryItemRecipeView {
  return {
    ...r,
    catalog_kind: r.minibar_item_id ? "minibar" : "poolbar",
    catalog_name: r.minibar_items?.name ?? r.poolbar_items?.name ?? "—",
  };
}

export async function getInventoryItemRecipes(inventoryItemId: string): Promise<InventoryItemRecipeView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_item_recipes")
    .select("*, minibar_items(name), poolbar_items(name)")
    .eq("inventory_item_id", inventoryItemId)
    .order("created_at");

  return ((data ?? []) as unknown as RecipeRaw[]).map(mapRecipeRow);
}

// Todas as fichas técnicas já cadastradas, agrupadas por item de estoque
// — usado pela tela "Itens de estoque" pra não precisar de uma consulta
// por item.
export async function getAllInventoryItemRecipesGrouped(): Promise<Record<string, InventoryItemRecipeView[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_item_recipes")
    .select("*, minibar_items(name), poolbar_items(name)")
    .order("created_at");

  const grouped: Record<string, InventoryItemRecipeView[]> = {};
  ((data ?? []) as unknown as RecipeRaw[]).forEach((r) => {
    const view = mapRecipeRow(r);
    (grouped[r.inventory_item_id] ??= []).push(view);
  });
  return grouped;
}

export async function addInventoryItemRecipe(
  inventoryItemId: string,
  kind: "minibar" | "poolbar",
  catalogItemId: string,
  portionsPerOrder: number
) {
  if (!catalogItemId) return { error: "Selecione o produto do cardápio." };
  if (portionsPerOrder <= 0) return { error: "Informe uma quantidade de porções maior que zero." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_item_recipes").insert({
    inventory_item_id: inventoryItemId,
    minibar_item_id: kind === "minibar" ? catalogItemId : null,
    poolbar_item_id: kind === "poolbar" ? catalogItemId : null,
    portions_per_order: portionsPerOrder,
  });

  if (error) {
    if (error.code === "23505") return { error: "Este produto já está ligado a este ingrediente." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function removeInventoryItemRecipe(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_item_recipes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

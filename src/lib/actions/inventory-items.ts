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
  revalidatePath("/custos-despesas", "layout");
  revalidatePath("/dashboard");
}

export interface InventoryItemWithBalance extends InventoryItem {
  category_ids: string[];
  category_names: string[];
  turnover_group_name: string | null;
  balance: number;
}

type CategoryLinkRaw = { inventory_item_id: string; category_id: string; expense_categories: { name: string } | null };

// Pra cada item, as categorias de gasto ligadas (N-pra-N desde a Parte
// 19) — uma consulta só, reaproveitada por getInventoryItems e por quem
// precisar montar o mesmo mapa (ex.: relatórios).
async function getCategoryLinksByItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemIds: string[]
): Promise<Map<string, { ids: string[]; names: string[] }>> {
  const map = new Map<string, { ids: string[]; names: string[] }>();
  if (itemIds.length === 0) return map;
  const { data } = await supabase
    .from("inventory_item_categories")
    .select("inventory_item_id, category_id, expense_categories(name)")
    .in("inventory_item_id", itemIds);
  ((data ?? []) as unknown as CategoryLinkRaw[]).forEach((r) => {
    const entry = map.get(r.inventory_item_id) ?? { ids: [], names: [] };
    entry.ids.push(r.category_id);
    entry.names.push(r.expense_categories?.name ?? "—");
    map.set(r.inventory_item_id, entry);
  });
  return map;
}

// Lista o catálogo com o saldo de cada item já calculado (soma de todos
// os movimentos — nunca um número guardado à parte, ver
// PRD_compras.md/schema.sql pro porquê). `onlyActive` filtra os
// desativados (tela de baixa/compra não precisa mostrá-los).
export async function getInventoryItems(onlyActive = true): Promise<InventoryItemWithBalance[]> {
  const supabase = await createClient();
  let query = supabase.from("inventory_items").select("*, inventory_turnover_groups(name)").order("position").order("name");
  if (onlyActive) query = query.eq("active", true);
  const { data } = await query;

  type Raw = InventoryItem & { inventory_turnover_groups: { name: string } | null };
  const items = (data ?? []) as unknown as Raw[];
  if (items.length === 0) return [];

  const [{ data: balances }, categoryLinks] = await Promise.all([
    supabase
      .from("inventory_balances")
      .select("inventory_item_id, balance")
      .in(
        "inventory_item_id",
        items.map((i) => i.id)
      ),
    getCategoryLinksByItem(supabase, items.map((i) => i.id)),
  ]);
  const balanceMap = new Map((balances ?? []).map((b) => [b.inventory_item_id, Number(b.balance)]));

  return items.map((i) => {
    const categories = categoryLinks.get(i.id) ?? { ids: [], names: [] };
    return {
      ...i,
      category_ids: categories.ids,
      category_names: categories.names,
      turnover_group_name: i.inventory_turnover_groups?.name ?? null,
      balance: balanceMap.get(i.id) ?? 0,
    };
  });
}

export async function findInventoryItemByBarcode(barcode: string): Promise<InventoryItemWithBalance | null> {
  const items = await getInventoryItems(true);
  return items.find((i) => i.barcode === barcode) ?? null;
}

// Grava as categorias de um item: apaga e reinsere (mesmo padrão já usado
// no projeto pra listas N-pra-N editadas como um todo, ex.: expense_items
// numa edição de despesa) — mais simples e seguro que tentar "diffar".
async function setItemCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  categoryIds: string[]
): Promise<{ error?: string }> {
  await supabase.from("inventory_item_categories").delete().eq("inventory_item_id", itemId);
  if (categoryIds.length === 0) return {};
  const { error } = await supabase
    .from("inventory_item_categories")
    .insert(categoryIds.map((category_id) => ({ inventory_item_id: itemId, category_id })));
  if (error) return { error: error.message };
  return {};
}

export async function createInventoryItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const categoryIds = formData.getAll("category_ids").map(String).filter(Boolean);
  const unit = String(formData.get("unit") ?? "un").trim() || "un";
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  const reorderRaw = String(formData.get("reorder_point") ?? "").trim();
  const reorder_point = reorderRaw ? Number(reorderRaw) : 0;
  const turnover_group_id = String(formData.get("turnover_group_id") ?? "").trim() || null;
  const portionWeightRaw = String(formData.get("portion_weight_kg") ?? "").trim();
  const portion_weight_kg = portionWeightRaw ? Number(portionWeightRaw) : null;

  if (!name) return { error: "Informe o nome do item." };
  if (categoryIds.length === 0) return { error: "Selecione ao menos uma categoria de gasto." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ name, unit, barcode, reorder_point, turnover_group_id, portion_weight_kg })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Já existe um item com esse código de barras." };
    return { error: error.message };
  }

  const catResult = await setItemCategories(supabase, data.id as string, categoryIds);
  if (catResult.error) return { error: catResult.error };

  revalidateAll();
  return { success: true, itemId: data.id as string };
}

export async function updateInventoryItem(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const categoryIds = formData.getAll("category_ids").map(String).filter(Boolean);
  const unit = String(formData.get("unit") ?? "un").trim() || "un";
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  const reorderRaw = String(formData.get("reorder_point") ?? "").trim();
  const reorder_point = reorderRaw ? Number(reorderRaw) : 0;
  const turnover_group_id = String(formData.get("turnover_group_id") ?? "").trim() || null;
  const portionWeightRaw = String(formData.get("portion_weight_kg") ?? "").trim();
  const portion_weight_kg = portionWeightRaw ? Number(portionWeightRaw) : null;
  const active = formData.get("active") === "on";

  if (!name) return { error: "Informe o nome do item." };
  if (categoryIds.length === 0) return { error: "Selecione ao menos uma categoria de gasto." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ name, unit, barcode, reorder_point, turnover_group_id, portion_weight_kg, active })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Já existe um item com esse código de barras." };
    return { error: error.message };
  }

  const catResult = await setItemCategories(supabase, id, categoryIds);
  if (catResult.error) return { error: catResult.error };

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
// Natureza de consumo (ver PRD_compras.md seção 19): um item de estoque é
// sempre "consumo autônomo" (baixa manual, ou venda direta no bar/frigobar
// quando ELE PRÓPRIO é o produto vendido — ver seed de itens "diretos").
// Quando tem 1+ fichas técnicas abaixo, ele TAMBÉM é consumido
// indiretamente (ingrediente de algum prato) — não existe um campo
// separado "natureza de consumo": é só a presença (ou ausência) destes
// vínculos.

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
  portionsCount: number,
  amountPerPortion: number
) {
  if (!catalogItemId) return { error: "Selecione o prato/produto do cardápio." };
  if (portionsCount <= 0) return { error: "Informe uma quantidade de porções maior que zero." };
  if (amountPerPortion < 0) return { error: "A quantidade na porção não pode ser negativa." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_item_recipes").insert({
    inventory_item_id: inventoryItemId,
    minibar_item_id: kind === "minibar" ? catalogItemId : null,
    poolbar_item_id: kind === "poolbar" ? catalogItemId : null,
    portions_count: portionsCount,
    amount_per_portion: amountPerPortion,
  });

  if (error) {
    if (error.code === "23505") return { error: "Este produto já está ligado a este ingrediente." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

// Corrige as quantidades de uma ficha técnica já existente — usado pela
// tela "Lista de pratos" quando o admin preenche a receita real de um
// prato que foi cadastrado sem receita (ver seed inicial, PRD_compras.md
// seção 19).
export async function updateInventoryItemRecipeQuantities(id: string, portionsCount: number, amountPerPortion: number) {
  if (portionsCount <= 0) return { error: "Informe uma quantidade de porções maior que zero." };
  if (amountPerPortion < 0) return { error: "A quantidade na porção não pode ser negativa." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_item_recipes")
    .update({ portions_count: portionsCount, amount_per_portion: amountPerPortion })
    .eq("id", id);
  if (error) return { error: error.message };
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

// ---------- "Lista de pratos: natureza do consumo" ----------
// Mesma ficha técnica acima, só que organizada a partir do PRATO (produto
// vendável do bar da piscina/frigobar) em vez do ingrediente — ver
// PRD_compras.md seção 19 pro porquê de não existir um catálogo de
// "pratos" separado: usar o catálogo que já existe garante que pedir o
// prato de verdade (comanda/frigobar) já desconta estoque, porque é o
// mesmo gatilho que já existia antes desta parte.
export interface DishView {
  id: string;
  name: string;
  kind: "minibar" | "poolbar";
  category: string | null; // só poolbar tem (Petiscos/Bebidas)
  ingredients: InventoryIngredientLink[];
}

export interface InventoryIngredientLink {
  recipe_id: string;
  inventory_item_id: string;
  item_name: string;
  item_unit: string;
  portions_count: number;
  amount_per_portion: number;
}

export async function getDishesWithIngredients(): Promise<DishView[]> {
  const supabase = await createClient();
  const [{ data: poolbar }, { data: minibar }, { data: recipes }] = await Promise.all([
    supabase.from("poolbar_items").select("id, name, category").order("category").order("name"),
    supabase.from("minibar_items").select("id, name").order("name"),
    supabase
      .from("inventory_item_recipes")
      .select("id, inventory_item_id, minibar_item_id, poolbar_item_id, portions_count, amount_per_portion, inventory_items(name, unit)"),
  ]);

  type RecipeRow = {
    id: string;
    inventory_item_id: string;
    minibar_item_id: string | null;
    poolbar_item_id: string | null;
    portions_count: number;
    amount_per_portion: number;
    inventory_items: { name: string; unit: string } | null;
  };
  const recipeRows = (recipes ?? []) as unknown as RecipeRow[];

  const ingredientsFor = (kind: "minibar" | "poolbar", catalogId: string): InventoryIngredientLink[] =>
    recipeRows
      .filter((r) => (kind === "minibar" ? r.minibar_item_id === catalogId : r.poolbar_item_id === catalogId))
      .map((r) => ({
        recipe_id: r.id,
        inventory_item_id: r.inventory_item_id,
        item_name: r.inventory_items?.name ?? "—",
        item_unit: r.inventory_items?.unit ?? "un",
        portions_count: Number(r.portions_count),
        amount_per_portion: Number(r.amount_per_portion),
      }));

  const dishes: DishView[] = [
    ...((poolbar ?? []) as { id: string; name: string; category: string | null }[]).map((p) => ({
      id: p.id,
      name: p.name,
      kind: "poolbar" as const,
      category: p.category,
      ingredients: ingredientsFor("poolbar", p.id),
    })),
    ...((minibar ?? []) as { id: string; name: string }[]).map((m) => ({
      id: m.id,
      name: m.name,
      kind: "minibar" as const,
      category: null,
      ingredients: ingredientsFor("minibar", m.id),
    })),
  ];

  return dishes;
}

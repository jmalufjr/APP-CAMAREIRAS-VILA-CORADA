"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryItem, InventoryItemRecipe } from "@/lib/types";
import { unitOptions, unitFactor } from "@/lib/units";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/checklists", "layout");
  revalidatePath("/estoque", "layout");
  revalidatePath("/manutencao/estoque", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/pedidos-compra", "layout");
  revalidatePath("/manutencao/pedidos-compra", "layout");
  revalidatePath("/custos-despesas", "layout");
  revalidatePath("/dashboard");
}

export interface InventoryItemWithBalance extends InventoryItem {
  balance: number;
  // Nomes dos subcentros do Plano de Contas que usam este item (via
  // cost_items.inventory_item_id) — só pra exibição (ex.: busca/baixa de
  // estoque); editar a categorização em si acontece no Plano de Contas,
  // não aqui.
  category_names: string[];
}

// Lista o catálogo com o saldo de cada item já calculado (soma de todos
// os movimentos — nunca um número guardado à parte, ver
// PRD_compras.md/schema.sql pro porquê). `onlyActive` filtra os
// desativados (tela de baixa/compra não precisa mostrá-los). Desde a
// Parte 21, a identidade/categoria do item vem do Plano de Contas (item
// de custo → subcentro → centro) — ver também
// `getInventoryItemsWithCostPlan` em inventory-cost-view.ts pra essa
// visão por centro/subcentro.
export async function getInventoryItems(onlyActive = true): Promise<InventoryItemWithBalance[]> {
  const supabase = await createClient();
  let query = supabase.from("inventory_items").select("*").order("position").order("name");
  if (onlyActive) query = query.eq("active", true);
  const { data } = await query;

  const items = (data ?? []) as InventoryItem[];
  if (items.length === 0) return [];

  const [{ data: balances }, { data: costItems }] = await Promise.all([
    supabase
      .from("inventory_balances")
      .select("inventory_item_id, balance")
      .in(
        "inventory_item_id",
        items.map((i) => i.id)
      ),
    supabase
      .from("cost_items")
      .select("inventory_item_id, cost_item_centers(cost_centers(name))")
      .in(
        "inventory_item_id",
        items.map((i) => i.id)
      ),
  ]);
  const balanceMap = new Map((balances ?? []).map((b) => [b.inventory_item_id, Number(b.balance)]));

  type CostItemRaw = { inventory_item_id: string; cost_item_centers: { cost_centers: { name: string } | null }[] };
  const categoryNamesByItem = new Map<string, string[]>();
  ((costItems ?? []) as unknown as CostItemRaw[]).forEach((c) => {
    if (!c.inventory_item_id) return;
    const names = c.cost_item_centers.map((l) => l.cost_centers?.name).filter((n): n is string => !!n);
    categoryNamesByItem.set(c.inventory_item_id, names);
  });

  return items.map((i) => ({ ...i, balance: balanceMap.get(i.id) ?? 0, category_names: categoryNamesByItem.get(i.id) ?? [] }));
}

export async function findInventoryItemByBarcode(barcode: string): Promise<InventoryItemWithBalance | null> {
  const items = await getInventoryItems(true);
  return items.find((i) => i.barcode === barcode) ?? null;
}

// "Dias de folga" (ver "Itens de estoque e ciclo de compras",
// PRD_compras.md seção 21) — único campo editável diretamente nessa
// tela, com o mesmo stepper ±1 já usado no resto do projeto.
export async function updateInventoryItemCoverageDays(id: string, days: number) {
  if (days < 1) return { error: "Os dias de folga precisam ser pelo menos 1." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update({ coverage_days: days }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// "É perecível?" (Módulo Contábil Leva 5) — só importa pro cálculo do
// custo do café da manhã (ver getBreakfastCostForPeriod em
// cost-accounting.ts): perecível entra pelo total comprado no período;
// não perecível entra pelo total baixado manualmente, valorizado pelo
// custo médio.
export async function updateInventoryItemPerishable(id: string, isPerishable: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update({ is_perishable: isPerishable }).eq("id", id);
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

// A ficha técnica sempre guarda a quantidade na unidade-base do
// ingrediente (é o que a baixa de estoque lê); a unidade que o admin
// escolheu (ex.: ml pra um item em L) fica só em display_unit, pra tela
// mostrar do jeito que ele digitou.
async function recipeAmountToBase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inventoryItemId: string,
  amount: number,
  unit: string | null | undefined
): Promise<{ base: number; displayUnit: string | null; error?: string }> {
  if (!unit) return { base: amount, displayUnit: null };
  const [{ data: inv }, { data: convs }] = await Promise.all([
    supabase.from("inventory_items").select("unit").eq("id", inventoryItemId).maybeSingle(),
    supabase.from("inventory_item_unit_conversions").select("unit_name, factor").eq("inventory_item_id", inventoryItemId),
  ]);
  if (!inv) return { base: amount, displayUnit: null, error: "Ingrediente não encontrado." };
  const baseUnit = inv.unit as string;
  const conversions = ((convs ?? []) as { unit_name: string; factor: number }[]).map((c) => ({ unit_name: c.unit_name, factor: Number(c.factor) }));
  if (unit.toLowerCase() === baseUnit.toLowerCase()) return { base: amount, displayUnit: null };
  const known = unitOptions(baseUnit, conversions).some((u) => u.unit_name.toLowerCase() === unit.toLowerCase());
  if (!known) return { base: amount, displayUnit: null, error: `A unidade "${unit}" não está cadastrada pra este ingrediente.` };
  return { base: amount * unitFactor(unit, baseUnit, conversions), displayUnit: unit };
}

export async function addInventoryItemRecipe(
  inventoryItemId: string,
  kind: "minibar" | "poolbar",
  catalogItemId: string,
  portionsCount: number,
  amountPerPortion: number,
  unit: string | null = null
) {
  if (!catalogItemId) return { error: "Selecione o prato/produto do cardápio." };
  if (portionsCount <= 0) return { error: "Informe uma quantidade de porções maior que zero." };
  if (amountPerPortion < 0) return { error: "A quantidade na porção não pode ser negativa." };

  const supabase = await createClient();
  const conv = await recipeAmountToBase(supabase, inventoryItemId, amountPerPortion, unit);
  if (conv.error) return { error: conv.error };
  const { error } = await supabase.from("inventory_item_recipes").insert({
    inventory_item_id: inventoryItemId,
    minibar_item_id: kind === "minibar" ? catalogItemId : null,
    poolbar_item_id: kind === "poolbar" ? catalogItemId : null,
    portions_count: portionsCount,
    amount_per_portion: conv.base,
    display_unit: conv.displayUnit,
  });

  if (error) {
    if (error.code === "23505") return { error: "Este produto já está ligado a este ingrediente." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

// Corrige as quantidades de uma ficha técnica já existente — usado pela
// tela "Ficha técnica de petiscos e drinks" quando o admin preenche a
// receita real de um prato que foi cadastrado sem receita.
export async function updateInventoryItemRecipeQuantities(
  id: string,
  portionsCount: number,
  amountPerPortion: number,
  unit: string | null = null
) {
  if (portionsCount <= 0) return { error: "Informe uma quantidade de porções maior que zero." };
  if (amountPerPortion < 0) return { error: "A quantidade na porção não pode ser negativa." };

  const supabase = await createClient();
  const { data: recipe } = await supabase.from("inventory_item_recipes").select("inventory_item_id").eq("id", id).maybeSingle();
  if (!recipe) return { error: "Ficha técnica não encontrada." };
  const conv = await recipeAmountToBase(supabase, recipe.inventory_item_id as string, amountPerPortion, unit);
  if (conv.error) return { error: conv.error };
  const { error } = await supabase
    .from("inventory_item_recipes")
    .update({ portions_count: portionsCount, amount_per_portion: conv.base, display_unit: conv.displayUnit })
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

// ---------- "Ficha técnica de petiscos e drinks" (ex-"Lista de pratos") ----------
// Mesma ficha técnica acima, só que organizada a partir do PRATO (produto
// vendável do bar da piscina/frigobar) em vez do ingrediente — ver
// PRD_compras.md seção 19/21 pro porquê de não existir um catálogo de
// "pratos" separado: usar o catálogo que já existe garante que pedir o
// prato de verdade (comanda/frigobar) já desconta estoque, porque é o
// mesmo gatilho que já existia antes desta parte. Desde a Parte 21, só
// mostra os PETISCOS e DRINKS de verdade — os produtos vendidos prontos
// (água, café, cerveja, refrigerante, campari) e todo o frigobar saem
// daqui, por não serem "fichas técnicas" de verdade.
const DIRECT_BAR_ITEMS_EXCLUDED = ["água com gás", "água sem gás", "água de coco", "café expresso", "campari", "cerveja", "refrigerante"];

export interface DishView {
  id: string;
  name: string;
  kind: "minibar" | "poolbar";
  category: string | null; // "Petiscos" ou "Drinks"
  ingredients: InventoryIngredientLink[];
}

export interface InventoryIngredientLink {
  recipe_id: string;
  inventory_item_id: string;
  item_name: string;
  item_unit: string;
  portions_count: number;
  // Sempre na unidade-base (item_unit); amount_display é o mesmo valor na
  // unidade que o admin escolheu (display_unit_name), só pra exibir/editar.
  amount_per_portion: number;
  display_unit_name: string;
  amount_display: number;
  unit_options: { unit_name: string; factor: number }[];
}

export async function getDishesWithIngredients(): Promise<DishView[]> {
  const supabase = await createClient();
  const [{ data: poolbar }, { data: recipes }, { data: convs }] = await Promise.all([
    supabase.from("poolbar_items").select("id, name, category").order("category").order("name"),
    supabase
      .from("inventory_item_recipes")
      .select("id, inventory_item_id, minibar_item_id, poolbar_item_id, portions_count, amount_per_portion, display_unit, inventory_items(name, unit)"),
    supabase.from("inventory_item_unit_conversions").select("inventory_item_id, unit_name, factor"),
  ]);
  const convByInv = new Map<string, { unit_name: string; factor: number }[]>();
  ((convs ?? []) as { inventory_item_id: string; unit_name: string; factor: number }[]).forEach((c) => {
    const list = convByInv.get(c.inventory_item_id) ?? [];
    list.push({ unit_name: c.unit_name, factor: Number(c.factor) });
    convByInv.set(c.inventory_item_id, list);
  });

  type RecipeRow = {
    id: string;
    inventory_item_id: string;
    minibar_item_id: string | null;
    poolbar_item_id: string | null;
    portions_count: number;
    amount_per_portion: number;
    display_unit: string | null;
    inventory_items: { name: string; unit: string } | null;
  };
  const recipeRows = (recipes ?? []) as unknown as RecipeRow[];

  const ingredientsFor = (poolbarId: string): InventoryIngredientLink[] =>
    recipeRows
      .filter((r) => r.poolbar_item_id === poolbarId)
      .map((r) => {
        const baseUnit = r.inventory_items?.unit ?? "un";
        const options = unitOptions(baseUnit, convByInv.get(r.inventory_item_id) ?? []);
        // Se a unidade escolhida deixou de existir (conversão apagada), volta pra base.
        const shown = options.find((o) => o.unit_name.toLowerCase() === (r.display_unit ?? baseUnit).toLowerCase()) ?? options[0];
        const base = Number(r.amount_per_portion);
        return {
          recipe_id: r.id,
          inventory_item_id: r.inventory_item_id,
          item_name: r.inventory_items?.name ?? "—",
          item_unit: baseUnit,
          portions_count: Number(r.portions_count),
          amount_per_portion: base,
          display_unit_name: shown.unit_name,
          amount_display: Math.round((base / shown.factor) * 1e6) / 1e6,
          unit_options: options,
        };
      });

  return ((poolbar ?? []) as { id: string; name: string; category: string | null }[])
    .filter((p) => !DIRECT_BAR_ITEMS_EXCLUDED.includes(p.name.trim().toLowerCase()))
    .map((p) => ({
      id: p.id,
      name: p.name,
      kind: "poolbar" as const,
      category: p.category === "Petiscos" ? "Petiscos" : "Drinks",
      ingredients: ingredientsFor(p.id),
    }));
}

// Opções do seletor de ingrediente na ficha técnica — só itens de custo
// (que representam estoque) ligados ao centro "Bar de piscina", como
// pedido (Parte 21 — na época, filtrava pelos subcentros "Alimentos",
// "Bebidas" e "Materiais de bar da piscina", todos debaixo desse mesmo
// centro; a camada de subcentro foi removida no Módulo Contábil Leva 1,
// então o filtro simplificou pro centro direto). O vínculo em si
// continua indo pro item de ESTOQUE (inventory_item_id), já que é o que
// o gatilho de baixa automática usa.
export interface IngredientOption {
  inventory_item_id: string;
  name: string;
  unit: string;
  unit_options: { unit_name: string; factor: number }[];
}

export async function getFichaTecnicaIngredientOptions(): Promise<IngredientOption[]> {
  const supabase = await createClient();
  const [{ data }, { data: convs }] = await Promise.all([
    supabase
      .from("cost_items")
      .select("inventory_item_id, name, inventory_items(unit), cost_item_centers(cost_centers(name))")
      .eq("is_inventory", true)
      .not("inventory_item_id", "is", null),
    supabase.from("inventory_item_unit_conversions").select("inventory_item_id, unit_name, factor"),
  ]);
  const convByInv = new Map<string, { unit_name: string; factor: number }[]>();
  ((convs ?? []) as { inventory_item_id: string; unit_name: string; factor: number }[]).forEach((c) => {
    const list = convByInv.get(c.inventory_item_id) ?? [];
    list.push({ unit_name: c.unit_name, factor: Number(c.factor) });
    convByInv.set(c.inventory_item_id, list);
  });

  type Raw = {
    inventory_item_id: string;
    name: string;
    inventory_items: { unit: string } | null;
    cost_item_centers: { cost_centers: { name: string } | null }[];
  };

  const seen = new Set<string>();
  const options: IngredientOption[] = [];
  ((data ?? []) as unknown as Raw[]).forEach((r) => {
    if (seen.has(r.inventory_item_id)) return;
    const inBarDePiscina = r.cost_item_centers.some((l) => l.cost_centers?.name === "Bar de piscina");
    if (!inBarDePiscina) return;
    seen.add(r.inventory_item_id);
    const unit = r.inventory_items?.unit ?? "un";
    options.push({
      inventory_item_id: r.inventory_item_id,
      name: r.name,
      unit,
      unit_options: unitOptions(unit, convByInv.get(r.inventory_item_id) ?? []),
    });
  });
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CostCenter, CostItem } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/checklists", "layout");
  revalidatePath("/compras", "layout");
  revalidatePath("/custos-despesas", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/contabil", "layout");
}

// ---------- Centros de custo ----------
// Desde o Módulo Contábil Leva 1, um item de custo liga direto no
// centro (sem subcentro no meio — PRD_compras&contabil.md seção 22.3
// item 2). `count_frequency_days` migrou do antigo subcentro pro
// próprio centro.

export async function getCostCenters(): Promise<CostCenter[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("cost_centers").select("*").order("position").order("name");
  return (data ?? []) as CostCenter[];
}

export async function createCostCenter(name: string) {
  if (!name.trim()) return { error: "Informe o nome do centro de custo." };
  const supabase = await createClient();
  const { error } = await supabase.from("cost_centers").insert({ name: name.trim() });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um centro de custo com esse nome." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function updateCostCenter(id: string, name: string, active: boolean, countFrequencyDays: number | null) {
  if (!name.trim()) return { error: "Informe o nome do centro de custo." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cost_centers")
    .update({ name: name.trim(), active, count_frequency_days: countFrequencyDays })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// Atalho pra editar só a frequência de contagem física de um centro,
// pelo nome — usado na tela "Contagem de estoque" (que já lista os
// centros pelo nome, sem precisar buscar o id/active pra só mudar esse
// campo).
export async function updateCostCenterCountFrequencyByName(name: string, days: number | null) {
  if (days !== null && days <= 0) return { error: "Informe uma frequência maior que zero, ou deixe em branco." };
  const supabase = await createClient();
  const { error } = await supabase.from("cost_centers").update({ count_frequency_days: days }).eq("name", name);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteCostCenter(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_centers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// ---------- Itens de custo ----------

export interface CostItemWithLinks extends CostItem {
  inventory_item_name: string | null;
  inventory_unit: string | null;
  centers: { center_id: string; center_name: string; alloc_pct: number }[];
}

export async function getCostItems(): Promise<CostItemWithLinks[]> {
  const supabase = await createClient();
  const [{ data: items }, { data: links }] = await Promise.all([
    supabase.from("cost_items").select("*, inventory_items(name, unit)").order("position").order("name"),
    supabase.from("cost_item_centers").select("cost_item_id, center_id, alloc_pct, cost_centers(name)"),
  ]);

  type ItemRaw = CostItem & { inventory_items: { name: string; unit: string } | null };
  type LinkRaw = { cost_item_id: string; center_id: string; alloc_pct: number; cost_centers: { name: string } | null };

  const linksByItem = new Map<string, { center_id: string; center_name: string; alloc_pct: number }[]>();
  ((links ?? []) as unknown as LinkRaw[]).forEach((l) => {
    const list = linksByItem.get(l.cost_item_id) ?? [];
    list.push({ center_id: l.center_id, center_name: l.cost_centers?.name ?? "—", alloc_pct: Number(l.alloc_pct) });
    linksByItem.set(l.cost_item_id, list);
  });

  return ((items ?? []) as unknown as ItemRaw[]).map((i) => ({
    ...i,
    inventory_item_name: i.inventory_items?.name ?? null,
    inventory_unit: i.inventory_items?.unit ?? null,
    centers: linksByItem.get(i.id) ?? [],
  }));
}

async function setItemCenterLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  costItemId: string,
  centerLinks: { center_id: string; alloc_pct: number }[]
): Promise<{ error?: string }> {
  if (centerLinks.length === 0) return { error: "Ligue o item de custo a pelo menos 1 centro de custo." };
  const sum = centerLinks.reduce((s, l) => s + l.alloc_pct, 0);
  if (sum !== 100) return { error: `Os percentuais dos centros precisam somar exatamente 100% (soma atual: ${sum}%).` };

  await supabase.from("cost_item_centers").delete().eq("cost_item_id", costItemId);
  const { error } = await supabase
    .from("cost_item_centers")
    .insert(centerLinks.map((l) => ({ cost_item_id: costItemId, center_id: l.center_id, alloc_pct: l.alloc_pct })));
  if (error) return { error: error.message };
  return {};
}

// Resolve o inventory_item_id a usar quando isInventory=true e o item de
// custo ainda não tem nenhum vínculo — liga a um item de estoque
// existente (inventoryItemId) ou cria um novo na hora (newInventoryItemName).
async function resolveNewInventoryLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inventoryItemId: string | null,
  newInventoryItemName: string | null
): Promise<{ id?: string | null; error?: string }> {
  if (inventoryItemId) return { id: inventoryItemId };
  if (newInventoryItemName?.trim()) {
    const { data: newItem, error } = await supabase
      .from("inventory_items")
      .insert({ name: newInventoryItemName.trim(), unit: "un" })
      .select("id")
      .single();
    if (error || !newItem) return { error: error?.message ?? "Erro ao criar item de estoque." };
    return { id: newItem.id as string };
  }
  return { error: "Selecione um item de estoque existente, ou informe o nome de um novo." };
}

// isInventory=true sempre liga a um item de estoque — existente
// (inventoryItemId) ou novo (newInventoryItemName, criado na hora).
export async function createCostItem(
  name: string,
  isInventory: boolean,
  inventoryItemId: string | null,
  newInventoryItemName: string | null,
  centerLinks: { center_id: string; alloc_pct: number }[]
) {
  if (!name.trim()) return { error: "Informe o nome do item de custo." };
  const supabase = await createClient();

  let resolvedInventoryItemId: string | null = null;
  if (isInventory) {
    const resolved = await resolveNewInventoryLink(supabase, inventoryItemId, newInventoryItemName);
    if (resolved.error) return { error: resolved.error };
    resolvedInventoryItemId = resolved.id ?? null;
  }

  const { data, error } = await supabase
    .from("cost_items")
    .insert({ name: name.trim(), is_inventory: isInventory, inventory_item_id: resolvedInventoryItemId })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { error: "Esse item de estoque já está ligado a outro item de custo." };
    return { error: error?.message ?? "Erro ao criar item de custo." };
  }

  const linkResult = await setItemCenterLinks(supabase, data.id as string, centerLinks);
  if (linkResult.error) return { error: linkResult.error };
  revalidateAll();
  return { success: true, id: data.id as string };
}

// "Representa estoque" pode ser ligada/desligada numa edição: marcar
// liga a um item de estoque (existente ou novo, igual à criação);
// desmarcar só desliga o vínculo (inventory_item_id volta a null — o
// item de estoque em si, com todo o saldo/histórico dele, não é
// apagado, só deixa de aparecer em "Itens de estoque e ciclo de
// compras"). Um vínculo já existente nunca é trocado por outro aqui —
// só criado (quando ainda não havia nenhum) ou removido.
export async function updateCostItem(
  id: string,
  name: string,
  active: boolean,
  isInventory: boolean,
  inventoryItemId: string | null,
  newInventoryItemName: string | null,
  centerLinks: { center_id: string; alloc_pct: number }[]
) {
  if (!name.trim()) return { error: "Informe o nome do item de custo." };
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("cost_items")
    .select("inventory_item_id")
    .eq("id", id)
    .single();
  if (currentError || !current) return { error: currentError?.message ?? "Item de custo não encontrado." };

  let resolvedInventoryItemId: string | null = current.inventory_item_id as string | null;
  if (isInventory && !resolvedInventoryItemId) {
    const resolved = await resolveNewInventoryLink(supabase, inventoryItemId, newInventoryItemName);
    if (resolved.error) return { error: resolved.error };
    resolvedInventoryItemId = resolved.id ?? null;
  } else if (!isInventory) {
    resolvedInventoryItemId = null;
  }

  const { error } = await supabase
    .from("cost_items")
    .update({ name: name.trim(), active, is_inventory: isInventory, inventory_item_id: resolvedInventoryItemId })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Esse item de estoque já está ligado a outro item de custo." };
    return { error: error.message };
  }

  const linkResult = await setItemCenterLinks(supabase, id, centerLinks);
  if (linkResult.error) return { error: linkResult.error };
  revalidateAll();
  return { success: true };
}

export async function deleteCostItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// Lista enxuta pra seletores (ex.: "Lançar compras e despesas") — só os
// itens ativos, com o essencial.
export interface CostItemOption {
  id: string;
  name: string;
  is_inventory: boolean;
  inventory_item_id: string | null;
}

export async function getCostItemOptions(): Promise<CostItemOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cost_items")
    .select("id, name, is_inventory, inventory_item_id")
    .eq("active", true)
    .order("name");
  return (data ?? []) as CostItemOption[];
}

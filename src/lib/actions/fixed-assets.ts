"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AssetCategory, FixedAsset, FixedAssetCatalogItem } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/ativo-permanente", "layout");
}

// ---------- Categorias ----------

export async function getAssetCategories(): Promise<AssetCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("asset_categories").select("*").order("position").order("name");
  return (data ?? []) as AssetCategory[];
}

export async function createAssetCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { error } = await supabase.from("asset_categories").insert({ name });
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma categoria com esse nome." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function updateAssetCategory(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!name) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { error } = await supabase.from("asset_categories").update({ name, active }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteAssetCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("asset_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// ---------- Catálogo de itens de ativo permanente (Plano de Contas) ----------

export async function getFixedAssetCatalogItems(): Promise<FixedAssetCatalogItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("fixed_asset_catalog_items").select("*").order("position").order("name");
  return (data ?? []) as FixedAssetCatalogItem[];
}

export async function createFixedAssetCatalogItem(name: string, categoryId: string) {
  if (!name.trim()) return { error: "Informe o nome do item." };
  if (!categoryId) return { error: "Selecione a categoria." };
  const supabase = await createClient();
  const { error } = await supabase.from("fixed_asset_catalog_items").insert({ name: name.trim(), category_id: categoryId });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um item com esse nome nessa categoria." };
    return { error: error.message };
  }
  revalidateAll();
  revalidatePath("/checklists", "layout");
  return { success: true };
}

export async function updateFixedAssetCatalogItem(id: string, name: string, categoryId: string, active: boolean) {
  if (!name.trim()) return { error: "Informe o nome do item." };
  if (!categoryId) return { error: "Selecione a categoria." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("fixed_asset_catalog_items")
    .update({ name: name.trim(), category_id: categoryId, active })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  revalidatePath("/checklists", "layout");
  return { success: true };
}

export async function deleteFixedAssetCatalogItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fixed_asset_catalog_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  revalidatePath("/checklists", "layout");
  return { success: true };
}

// ---------- Itens de ativo permanente ----------

export interface FixedAssetWithCategory extends FixedAsset {
  category_name: string;
}

export async function getFixedAssets(): Promise<FixedAssetWithCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fixed_assets")
    .select("*, asset_categories(name)")
    .order("created_at", { ascending: false });

  type Raw = FixedAsset & { asset_categories: { name: string } | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({ ...r, category_name: r.asset_categories?.name ?? "—" }));
}

// Um bem só é criado ao lançar uma compra de ativo permanente em
// "Lançar compras e despesas" (ver resolveExpenseItemsForInsert em
// src/lib/actions/expenses.ts) — não há CRUD manual direto aqui; "active"
// é ajustável só por quem tem acesso direto ao banco, por ora.

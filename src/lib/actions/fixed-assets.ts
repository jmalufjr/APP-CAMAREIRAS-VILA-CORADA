"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AssetCategory, FixedAsset } from "@/lib/types";

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

function parseAssetFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "");
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const purchase_date = String(formData.get("purchase_date") ?? "").trim() || null;
  const purchaseValueRaw = String(formData.get("purchase_value") ?? "").trim();
  const purchase_value = purchaseValueRaw ? Number(purchaseValueRaw) : null;
  const warranty_until = String(formData.get("warranty_until") ?? "").trim() || null;
  const supplier_name = String(formData.get("supplier_name") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  return { name, category_id, brand, model, purchase_date, purchase_value, warranty_until, supplier_name, location, notes };
}

export async function createFixedAsset(formData: FormData) {
  const parsed = parseAssetFormData(formData);
  if (!parsed.name || !parsed.category_id) return { error: "Informe o nome e a categoria do item." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("fixed_assets").insert({ ...parsed, created_by: user?.id ?? null });
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function updateFixedAsset(id: string, formData: FormData) {
  const parsed = parseAssetFormData(formData);
  const active = formData.get("active") === "on";
  if (!parsed.name || !parsed.category_id) return { error: "Informe o nome e a categoria do item." };

  const supabase = await createClient();
  const { error } = await supabase.from("fixed_assets").update({ ...parsed, active }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteFixedAsset(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fixed_assets").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

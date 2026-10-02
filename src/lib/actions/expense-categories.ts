"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ExpenseCategory } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("expense_categories").select("*").order("position").order("name");
  return (data ?? []) as ExpenseCategory[];
}

export async function createExpenseCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const isInventory = formData.get("is_inventory_category") === "on";
  if (!name) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .insert({ name, is_inventory_category: isInventory });

  if (error) {
    if (error.code === "23505") return { error: "Já existe uma categoria com esse nome." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function updateExpenseCategory(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const isInventory = formData.get("is_inventory_category") === "on";
  const active = formData.get("active") === "on";
  if (!name) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({ name, is_inventory_category: isInventory, active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// Frequência de contagem física (dias) — campo independente, editado
// direto na tela "Contagem de estoque", não no formulário de categoria.
export async function updateExpenseCategoryCountFrequency(id: string, days: number | null) {
  if (days !== null && days <= 0) return { error: "Informe uma frequência maior que zero, ou deixe em branco." };
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").update({ count_frequency_days: days }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteExpenseCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

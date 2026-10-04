"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ExpenseCategory, CostNature } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/custos-despesas", "layout");
  revalidatePath("/dashboard");
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

// Natureza de custo + os 4 percentuais de rateio (ver "Custos e
// Despesas", PRD_compras.md seção 20) — editada numa ação própria,
// separada do form simples de nome/ativo, pra não precisar reenviar
// todos os campos juntos a cada edição.
export async function updateExpenseCategoryCostSettings(
  id: string,
  costNature: CostNature,
  pcts: { hospedagem: number; cafeManha: number; bar: number; frigobar: number }
) {
  if (costNature === "custo_fixo" && pcts.hospedagem + pcts.cafeManha + pcts.bar + pcts.frigobar !== 100) {
    return { error: "Os 4 percentuais precisam somar exatamente 100%." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({
      cost_nature: costNature,
      alloc_hospedagem_pct: pcts.hospedagem,
      alloc_cafe_manha_pct: pcts.cafeManha,
      alloc_bar_pct: pcts.bar,
      alloc_frigobar_pct: pcts.frigobar,
    })
    .eq("id", id);
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

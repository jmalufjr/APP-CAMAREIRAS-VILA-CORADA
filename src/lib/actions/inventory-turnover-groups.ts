"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryTurnoverGroup } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/dashboard");
}

// Grupos de giro: ciclo de reposição por categoria de controle fino
// (ex.: "Bebidas alcoólicas" compra a cada 60 dias, "Limpeza" toda
// semana) — coverage_days é o parâmetro editável pelo admin usado no
// cálculo do ponto de reposição automático (ver inventory_purchase_suggestions).
export async function getInventoryTurnoverGroups(): Promise<InventoryTurnoverGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("inventory_turnover_groups").select("*").order("name");
  return (data ?? []) as InventoryTurnoverGroup[];
}

export async function createInventoryTurnoverGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const coverageRaw = String(formData.get("coverage_days") ?? "").trim();
  const coverage_days = Number(coverageRaw);

  if (!name) return { error: "Informe o nome do grupo." };
  if (!coverageRaw || coverage_days <= 0) return { error: "Informe os dias de folga (maior que zero)." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_turnover_groups").insert({ name, coverage_days });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um grupo com esse nome." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function updateInventoryTurnoverGroupCoverageDays(id: string, coverageDays: number) {
  if (coverageDays <= 0) return { error: "Informe os dias de folga (maior que zero)." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_turnover_groups")
    .update({ coverage_days: coverageDays })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteInventoryTurnoverGroup(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_turnover_groups").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

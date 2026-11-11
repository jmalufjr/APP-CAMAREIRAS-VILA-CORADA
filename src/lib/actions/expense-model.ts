"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import type {
  CenterCode,
  ExpenseCategory,
  ExpenseSettings,
  Ingredient,
  RecurringExpense,
} from "@/lib/expense-model-types";

type Result = { error?: string; success?: boolean };
const ROLES = ["admin", "gerente_operacional"] as const;

function refresh() {
  revalidatePath("/contabil", "layout");
}

// ---------- Categorias de despesa ----------

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const [{ data: cats }, { data: centers }] = await Promise.all([
    supabase.from("expense_categories").select("*").order("position").order("name"),
    supabase.from("expense_category_centers").select("category_id, center_code, pct"),
  ]);
  return (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    consumption_days: c.consumption_days,
    rule: c.rule,
    active: c.active,
    position: c.position,
    centers: (centers ?? [])
      .filter((x) => x.category_id === c.id)
      .map((x) => ({ center_code: x.center_code as CenterCode, pct: Number(x.pct) })),
  }));
}

export async function saveExpenseCategory(
  id: string | null,
  name: string,
  consumptionDays: number,
  active: boolean,
  centers: { center_code: CenterCode; pct: number }[]
): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  name = name.trim();
  if (!name) return { error: "Informe o nome da categoria." };
  if (!Number.isInteger(consumptionDays) || consumptionDays < 1) return { error: "O prazo de consumo deve ser de 1 dia ou mais." };

  const supabase = await createClient();
  let categoryId = id;
  let rule: string = "fixo";

  if (id) {
    const { data: cur } = await supabase.from("expense_categories").select("rule").eq("id", id).single();
    rule = cur?.rule ?? "fixo";
    const { error } = await supabase
      .from("expense_categories")
      .update({ name, consumption_days: consumptionDays, active })
      .eq("id", id);
    if (error) return { error: error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message };
  } else {
    const { data, error } = await supabase
      .from("expense_categories")
      .insert({ name, consumption_days: consumptionDays, active, rule: "fixo", position: 100 })
      .select("id")
      .single();
    if (error) return { error: error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message };
    categoryId = data.id;
  }

  // Percentuais só valem para a regra "fixo".
  if (rule === "fixo" && categoryId) {
    const rows = centers.filter((c) => c.pct > 0);
    const total = rows.reduce((s, c) => s + c.pct, 0);
    if (Math.abs(total - 100) > 0.01) return { error: "Os percentuais dos centros devem somar 100%." };
    const { error: delErr } = await supabase.from("expense_category_centers").delete().eq("category_id", categoryId);
    if (delErr) return { error: delErr.message };
    const { error: insErr } = await supabase
      .from("expense_category_centers")
      .insert(rows.map((c) => ({ category_id: categoryId, center_code: c.center_code, pct: c.pct })));
    if (insErr) return { error: insErr.message };
  }

  refresh();
  return { success: true };
}

export async function deleteExpenseCategory(id: string): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  const supabase = await createClient();
  const { count } = await supabase
    .from("purchase_lines")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) return { error: "Há compras usando esta categoria. Desative-a em vez de excluir." };
  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}

// ---------- Ingredientes ----------

export async function getIngredients(): Promise<Ingredient[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("id, name, bar_pct, active").order("name");
  return (data ?? []).map((i) => ({ ...i, bar_pct: Number(i.bar_pct) })) as Ingredient[];
}

export async function saveIngredient(id: string | null, name: string, barPct: number, active: boolean): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  name = name.trim();
  if (!name) return { error: "Informe o nome do ingrediente." };
  if (!(barPct >= 0 && barPct <= 100)) return { error: "O percentual do Bar deve ficar entre 0 e 100." };
  const supabase = await createClient();
  const payload = { name, bar_pct: barPct, active };
  const { error } = id
    ? await supabase.from("ingredients").update(payload).eq("id", id)
    : await supabase.from("ingredients").insert(payload);
  if (error) return { error: error.code === "23505" ? "Já existe um ingrediente com esse nome." : error.message };
  refresh();
  return { success: true };
}

export async function deleteIngredient(id: string): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}

// ---------- Parâmetros (ativo permanente, janela de lançamento tardio) ----------

export async function getExpenseSettings(): Promise<ExpenseSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_settings")
    .select("asset_threshold, asset_min_life_months, late_window_days, start_date")
    .eq("id", true)
    .single();
  return {
    asset_threshold: Number(data?.asset_threshold ?? 1200),
    asset_min_life_months: data?.asset_min_life_months ?? 12,
    late_window_days: data?.late_window_days ?? 30,
    start_date: data?.start_date ?? "2026-11-01",
  };
}

export async function updateExpenseSettings(assetThreshold: number, minLifeMonths: number): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  if (!(assetThreshold > 0)) return { error: "Informe um valor de limite maior que zero." };
  if (!Number.isInteger(minLifeMonths) || minLifeMonths < 1) return { error: "Informe a vida útil mínima em meses." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_settings")
    .update({ asset_threshold: assetThreshold, asset_min_life_months: minLifeMonths })
    .eq("id", true);
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}

// ---------- Itens recorrentes ----------

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_expenses")
    .select("id, name, category_id, amount, day_of_month, active")
    .order("name");
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as RecurringExpense[];
}

export async function saveRecurringExpense(
  id: string | null,
  name: string,
  categoryId: string,
  amount: number,
  dayOfMonth: number,
  active: boolean
): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  name = name.trim();
  if (!name) return { error: "Informe o nome do item." };
  if (!categoryId) return { error: "Escolha a categoria." };
  if (!(amount >= 0)) return { error: "Informe o valor." };
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) return { error: "O dia deve ficar entre 1 e 28." };
  const supabase = await createClient();
  const payload = { name, category_id: categoryId, amount, day_of_month: dayOfMonth, active };
  const { error } = id
    ? await supabase.from("recurring_expenses").update(payload).eq("id", id)
    : await supabase.from("recurring_expenses").insert(payload);
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}

export async function deleteRecurringExpense(id: string): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}

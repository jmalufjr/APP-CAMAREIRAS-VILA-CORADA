"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayKey, tomorrowKey, daysAgoKey } from "@/lib/date";
import type { MaintenanceExecutionType } from "@/lib/types";

// ---------- Admin: CRUD de categorias ----------

export async function createMaintenanceCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("maintenance_categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase
    .from("maintenance_categories")
    .insert({ name, position: (max?.position ?? 0) + 1 });

  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

export async function updateMaintenanceCategory(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_categories").update({ name, active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

export async function deleteMaintenanceCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

// ---------- Admin: CRUD de itens ----------

export async function createMaintenanceItem(formData: FormData) {
  const categoryId = String(formData.get("category_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const executionType = String(formData.get("execution_type") ?? "nao_tecnico") as MaintenanceExecutionType;
  const periodicityDays = Number(formData.get("periodicity_days") ?? 0);

  if (!categoryId) return { error: "Selecione a categoria." };
  if (!label) return { error: "Informe o texto do item." };
  if (!periodicityDays || periodicityDays <= 0) return { error: "Informe a periodicidade em dias." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("maintenance_items")
    .select("position")
    .eq("category_id", categoryId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase.from("maintenance_items").insert({
    category_id: categoryId,
    label,
    description,
    execution_type: executionType,
    periodicity_days: periodicityDays,
    position: (max?.position ?? 0) + 1,
  });

  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

export async function updateMaintenanceItem(id: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const executionType = String(formData.get("execution_type") ?? "nao_tecnico") as MaintenanceExecutionType;
  const periodicityDays = Number(formData.get("periodicity_days") ?? 0);
  const active = formData.get("active") === "on";

  if (!label) return { error: "Informe o texto do item." };
  if (!periodicityDays || periodicityDays <= 0) return { error: "Informe a periodicidade em dias." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_items")
    .update({ label, description, execution_type: executionType, periodicity_days: periodicityDays, active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

export async function deleteMaintenanceItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/checklists");
  return { success: true };
}

// ---------- Funcionário de manutenção ----------

export interface MaintenanceItemRow {
  id: string;
  category_id: string;
  label: string;
  description: string | null;
  execution_type: MaintenanceExecutionType;
  periodicity_days: number;
  next_due_date: string;
  status: "pendente" | "selecionada";
  selected_by: string | null;
  selected_at: string | null;
  category_name: string;
  selected_by_profile: { name: string } | null;
}

const ITEM_SELECT =
  "id, category_id, label, description, execution_type, periodicity_days, next_due_date, status, selected_by, selected_at, maintenance_categories(name), selected_by_profile:profiles!maintenance_items_selected_by_fkey(name)";

export interface MaintenanceCategoryOverview {
  category_id: string;
  category_name: string;
  items: MaintenanceItemRow[];
}

export async function getManutencaoPreventivaOverview(): Promise<{
  dueByCategory: MaintenanceCategoryOverview[];
  upcoming: MaintenanceItemRow[];
}> {
  const supabase = await createClient();
  const tomorrow = tomorrowKey();
  const in30days = daysAgoKey(-30);

  const [{ data: due }, { data: upcoming }] = await Promise.all([
    supabase
      .from("maintenance_items")
      .select(ITEM_SELECT)
      .eq("active", true)
      .lte("next_due_date", tomorrow)
      .order("next_due_date", { ascending: true }),
    supabase
      .from("maintenance_items")
      .select(ITEM_SELECT)
      .eq("active", true)
      .gt("next_due_date", tomorrow)
      .lte("next_due_date", in30days)
      .order("next_due_date", { ascending: true }),
  ]);

  type Raw = Omit<MaintenanceItemRow, "category_name"> & {
    maintenance_categories: { name: string } | null;
  };

  const mapRow = (r: Raw): MaintenanceItemRow => ({
    ...r,
    category_name: r.maintenance_categories?.name ?? "—",
  });

  const dueRows = ((due ?? []) as unknown as Raw[]).map(mapRow);
  const upcomingRows = ((upcoming ?? []) as unknown as Raw[]).map(mapRow);

  const byCategory = new Map<string, MaintenanceCategoryOverview>();
  dueRows.forEach((item) => {
    const entry = byCategory.get(item.category_id) ?? {
      category_id: item.category_id,
      category_name: item.category_name,
      items: [],
    };
    entry.items.push(item);
    byCategory.set(item.category_id, entry);
  });

  return {
    dueByCategory: Array.from(byCategory.values()).sort((a, b) => a.category_name.localeCompare(b.category_name)),
    upcoming: upcomingRows,
  };
}

export async function claimMaintenanceCategory(categoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_maintenance_category", { cat_id: categoryId });
  if (error) return { error: error.message };
  revalidatePath("/manutencao/preventiva");
  revalidatePath("/manutencao-preventiva");
  return { success: true };
}

export async function getMaintenanceCategoryDetail(categoryId: string): Promise<{
  category_name: string;
  naoTecnico: MaintenanceItemRow[];
  tecnico: MaintenanceItemRow[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("maintenance_items")
    .select(ITEM_SELECT)
    .eq("category_id", categoryId)
    .eq("status", "selecionada")
    .eq("selected_by", user?.id ?? "")
    .order("position", { ascending: true });

  type Raw = Omit<MaintenanceItemRow, "category_name"> & {
    maintenance_categories: { name: string } | null;
  };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    ...r,
    category_name: r.maintenance_categories?.name ?? "—",
  }));

  return {
    category_name: rows[0]?.category_name ?? "—",
    naoTecnico: rows.filter((r) => r.execution_type === "nao_tecnico"),
    tecnico: rows.filter((r) => r.execution_type === "tecnico"),
  };
}

export async function completeMaintenanceNaoTecnico(categoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_maintenance_nao_tecnico", { cat_id: categoryId });
  if (error) return { error: error.message };
  revalidatePath("/manutencao/preventiva");
  revalidatePath("/manutencao-preventiva");
  return { success: true };
}

// ---------- Admin: visão da Manutenção Preventiva ----------

export interface MaintenanceCompletionRow {
  id: string;
  due_date: string;
  completed_at: string;
  external_technician_name: string | null;
  completed_by_profile: { name: string } | null;
  item_label: string;
  category_name: string;
  execution_type: MaintenanceExecutionType;
}

export async function getAdminPreventivaOverview(): Promise<{
  pendingTodayTomorrow: MaintenanceItemRow[];
  completedTodayTomorrow: MaintenanceCompletionRow[];
  nextTwoMonths: MaintenanceItemRow[];
}> {
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const dayAfterTomorrow = daysAgoKey(-2);
  const in60days = daysAgoKey(-60);

  const [{ data: pending }, { data: completions }, { data: upcoming }] = await Promise.all([
    supabase
      .from("maintenance_items")
      .select(ITEM_SELECT)
      .eq("active", true)
      .lte("next_due_date", tomorrow)
      .order("next_due_date", { ascending: true }),
    supabase
      .from("maintenance_completions")
      .select(
        "id, due_date, completed_at, external_technician_name, completed_by_profile:profiles!maintenance_completions_completed_by_fkey(name), maintenance_items(label, execution_type, maintenance_categories(name))"
      )
      .gte("completed_at", today)
      .lt("completed_at", dayAfterTomorrow)
      .order("completed_at", { ascending: false }),
    supabase
      .from("maintenance_items")
      .select(ITEM_SELECT)
      .eq("active", true)
      .gt("next_due_date", tomorrow)
      .lte("next_due_date", in60days)
      .order("next_due_date", { ascending: true }),
  ]);

  type ItemRaw = Omit<MaintenanceItemRow, "category_name"> & {
    maintenance_categories: { name: string } | null;
  };
  const mapItem = (r: ItemRaw): MaintenanceItemRow => ({
    ...r,
    category_name: r.maintenance_categories?.name ?? "—",
  });

  type CompletionRaw = {
    id: string;
    due_date: string;
    completed_at: string;
    external_technician_name: string | null;
    completed_by_profile: { name: string } | null;
    maintenance_items: {
      label: string;
      execution_type: MaintenanceExecutionType;
      maintenance_categories: { name: string } | null;
    } | null;
  };

  const mapCompletion = (r: CompletionRaw): MaintenanceCompletionRow => ({
    id: r.id,
    due_date: r.due_date,
    completed_at: r.completed_at,
    external_technician_name: r.external_technician_name,
    completed_by_profile: r.completed_by_profile,
    item_label: r.maintenance_items?.label ?? "—",
    category_name: r.maintenance_items?.maintenance_categories?.name ?? "—",
    execution_type: r.maintenance_items?.execution_type ?? "nao_tecnico",
  });

  return {
    pendingTodayTomorrow: ((pending ?? []) as unknown as ItemRaw[]).map(mapItem),
    completedTodayTomorrow: ((completions ?? []) as unknown as CompletionRaw[]).map(mapCompletion),
    nextTwoMonths: ((upcoming ?? []) as unknown as ItemRaw[]).map(mapItem),
  };
}

export async function completeMaintenanceTecnico(categoryId: string, externalName: string) {
  if (!externalName.trim()) return { error: "Informe o nome do técnico externo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_maintenance_tecnico", {
    cat_id: categoryId,
    external_name: externalName.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/manutencao/preventiva");
  revalidatePath("/manutencao-preventiva");
  return { success: true };
}

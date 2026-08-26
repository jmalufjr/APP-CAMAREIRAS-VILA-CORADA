"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayKey, mondayKey, fridayKey, addDaysKey } from "@/lib/date";
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

// Um "card" de trabalho é uma categoria + a semana (segunda a sexta) a que
// pertencem seus itens vencidos ainda não resolvidos. Uma categoria pode
// aparecer em mais de um card se tiver itens atrasados de semanas diferentes.
export interface MaintenanceCategoryOverview {
  category_id: string;
  category_name: string;
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  items: MaintenanceItemRow[];
}

export async function getManutencaoPreventivaOverview(): Promise<{
  dueByCategory: MaintenanceCategoryOverview[];
  nextFourWeeks: WeeklyPlanningRow[];
}> {
  const supabase = await createClient();
  const currentWeekStart = mondayKey(todayKey());
  const currentWeekEnd = fridayKey(todayKey());

  const { data: due } = await supabase
    .from("maintenance_items")
    .select(ITEM_SELECT)
    .eq("active", true)
    .lte("next_due_date", currentWeekEnd)
    .order("next_due_date", { ascending: true });

  type Raw = Omit<MaintenanceItemRow, "category_name"> & {
    maintenance_categories: { name: string } | null;
  };

  const dueRows = ((due ?? []) as unknown as Raw[]).map(
    (r): MaintenanceItemRow => ({ ...r, category_name: r.maintenance_categories?.name ?? "—" })
  );

  const byCard = new Map<string, MaintenanceCategoryOverview>();
  dueRows.forEach((item) => {
    const weekStart = mondayKey(item.next_due_date);
    const key = `${item.category_id}__${weekStart}`;
    const entry = byCard.get(key) ?? {
      category_id: item.category_id,
      category_name: item.category_name,
      weekStart,
      weekEnd: fridayKey(weekStart),
      isCurrentWeek: weekStart === currentWeekStart,
      items: [],
    };
    entry.items.push(item);
    byCard.set(key, entry);
  });

  const cards = Array.from(byCard.values()).sort((a, b) => {
    if (a.isCurrentWeek !== b.isCurrentWeek) return a.isCurrentWeek ? -1 : 1;
    if (a.weekStart !== b.weekStart) return b.weekStart.localeCompare(a.weekStart);
    return a.category_name.localeCompare(b.category_name);
  });

  const nextWeekStart = addDaysKey(currentWeekEnd, 3);
  const fourWeeksEnd = fridayKey(addDaysKey(nextWeekStart, 21));
  const nextFourWeeks = await getWeeklyPlanningSummary(nextWeekStart, fourWeeksEnd);

  return { dueByCategory: cards, nextFourWeeks };
}

export async function claimMaintenanceCategory(categoryId: string, weekStart: string, weekEnd: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_maintenance_category", {
    cat_id: categoryId,
    due_from: weekStart,
    due_to: weekEnd,
  });
  if (error) return { error: error.message };
  revalidatePath("/manutencao/preventiva");
  revalidatePath("/manutencao-preventiva");
  return { success: true };
}

export async function getMaintenanceCategoryDetail(
  categoryId: string,
  weekStart: string,
  weekEnd: string
): Promise<{
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
    .gte("next_due_date", weekStart)
    .lte("next_due_date", weekEnd)
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

export async function completeMaintenanceNaoTecnico(categoryId: string, weekStart: string, weekEnd: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_maintenance_nao_tecnico", {
    cat_id: categoryId,
    due_from: weekStart,
    due_to: weekEnd,
  });
  if (error) return { error: error.message };
  revalidatePath("/manutencao/preventiva");
  revalidatePath("/manutencao-preventiva");
  return { success: true };
}

// ---------- Admin: visão da Manutenção Preventiva ----------

export interface WeekMaintenanceRow {
  id: string;
  category_name: string;
  item_label: string;
  item_description: string | null;
  execution_type: MaintenanceExecutionType;
  due_date: string;
  status: "pendente" | "selecionada" | "concluida";
  selected_by_name: string | null;
  selected_at: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  external_technician_name: string | null;
}

// Linhas de manutenção preventiva (pendentes/selecionadas ao vivo +
// histórico de conclusões) cuja data prevista cai dentro de [from, to].
// Serve tanto a tabela da semana corrente quanto a página de uma semana
// específica quanto a agregação semanal do planejamento.
export async function getMaintenanceRangeRows(from: string, to: string): Promise<WeekMaintenanceRow[]> {
  const supabase = await createClient();

  const [{ data: items }, { data: completions }] = await Promise.all([
    supabase
      .from("maintenance_items")
      .select(ITEM_SELECT)
      .eq("active", true)
      .gte("next_due_date", from)
      .lte("next_due_date", to),
    supabase
      .from("maintenance_completions")
      .select(
        "id, due_date, completed_at, external_technician_name, completed_by_profile:profiles!maintenance_completions_completed_by_fkey(name), maintenance_items(label, description, execution_type, maintenance_categories(name))"
      )
      .gte("due_date", from)
      .lte("due_date", to),
  ]);

  type ItemRaw = Omit<MaintenanceItemRow, "category_name"> & {
    maintenance_categories: { name: string } | null;
  };
  const itemRows: WeekMaintenanceRow[] = ((items ?? []) as unknown as ItemRaw[]).map((r) => ({
    id: r.id,
    category_name: r.maintenance_categories?.name ?? "—",
    item_label: r.label,
    item_description: r.description,
    execution_type: r.execution_type,
    due_date: r.next_due_date,
    status: r.status,
    selected_by_name: r.selected_by_profile?.name ?? null,
    selected_at: r.selected_at,
    completed_by_name: null,
    completed_at: null,
    external_technician_name: null,
  }));

  type CompletionRaw = {
    id: string;
    due_date: string;
    completed_at: string;
    external_technician_name: string | null;
    completed_by_profile: { name: string } | null;
    maintenance_items: {
      label: string;
      description: string | null;
      execution_type: MaintenanceExecutionType;
      maintenance_categories: { name: string } | null;
    } | null;
  };
  const completionRows: WeekMaintenanceRow[] = ((completions ?? []) as unknown as CompletionRaw[]).map((r) => ({
    id: `completion-${r.id}`,
    category_name: r.maintenance_items?.maintenance_categories?.name ?? "—",
    item_label: r.maintenance_items?.label ?? "—",
    item_description: r.maintenance_items?.description ?? null,
    execution_type: r.maintenance_items?.execution_type ?? "nao_tecnico",
    due_date: r.due_date,
    status: "concluida",
    selected_by_name: null,
    selected_at: null,
    completed_by_name: r.completed_by_profile?.name ?? null,
    completed_at: r.completed_at,
    external_technician_name: r.external_technician_name,
  }));

  return [...itemRows, ...completionRows].sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export interface WeeklyPlanningRow {
  weekStart: string;
  weekEnd: string;
  categories: string;
  execution: string;
  status: "pendente" | "selecionada" | "concluida";
}

export async function getWeeklyPlanningSummary(from: string, to: string): Promise<WeeklyPlanningRow[]> {
  const rows = await getMaintenanceRangeRows(from, to);

  const byWeek = new Map<string, WeekMaintenanceRow[]>();
  rows.forEach((row) => {
    const weekStart = mondayKey(row.due_date);
    const list = byWeek.get(weekStart) ?? [];
    list.push(row);
    byWeek.set(weekStart, list);
  });

  return Array.from(byWeek.entries())
    .map(([weekStart, weekRows]) => {
      const categories = Array.from(new Set(weekRows.map((r) => r.category_name))).sort();
      const hasNaoTecnico = weekRows.some((r) => r.execution_type === "nao_tecnico");
      const hasTecnico = weekRows.some((r) => r.execution_type === "tecnico");
      const execution = hasNaoTecnico && hasTecnico ? "Ambos" : hasTecnico ? "Técnico" : "Não técnico";
      const status: WeeklyPlanningRow["status"] = weekRows.some((r) => r.status === "selecionada")
        ? "selecionada"
        : weekRows.some((r) => r.status === "pendente")
          ? "pendente"
          : "concluida";

      return {
        weekStart,
        weekEnd: fridayKey(weekStart),
        categories: categories.join(", "),
        execution,
        status,
      };
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export async function completeMaintenanceTecnico(
  categoryId: string,
  weekStart: string,
  weekEnd: string,
  externalName: string
) {
  if (!externalName.trim()) return { error: "Informe o nome do técnico externo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_maintenance_tecnico", {
    cat_id: categoryId,
    due_from: weekStart,
    due_to: weekEnd,
    external_name: externalName.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/manutencao/preventiva");
  revalidatePath("/manutencao-preventiva");
  return { success: true };
}

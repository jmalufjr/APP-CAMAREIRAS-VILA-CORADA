"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { uploadExpenseReceipt, signExpenseReceiptUrl } from "@/lib/expense-receipts";
import type { PaymentMethod } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/custos-despesas", "layout");
  revalidatePath("/dashboard");
}

export interface ExpenseItemInput {
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  inventory_item_id: string | null;
  // Categoria da própria linha — só usada (e só obrigatória) quando NÃO
  // há item de estoque vinculado (nem existente, nem novo), ex.: salário,
  // conta de luz avulsa, honorários (Parte 20 — fecha a lacuna da Parte
  // 19, que só dava categoria a quem tinha item de estoque).
  category_id: string | null;
  // Presente só quando a pessoa escolheu "criar novo item de estoque" pra
  // esta linha, em vez de vincular a um já existente ou deixar sem
  // controle de estoque — ver resolveOrCreateInventoryItemId abaixo.
  // category_ids: um item pode pertencer a mais de uma categoria de gasto
  // ao mesmo tempo (Parte 19) — essa informação vive só no item, não na
  // despesa inteira (uma despesa pode ter itens de categorias diferentes).
  new_item?: { category_ids: string[]; unit: string; turnover_group_id: string | null } | null;
}

// Resolve o item de estoque de uma linha: usa o vinculado (se houver),
// cria um novo (se pedido), ou deixa null (sem controle de estoque). Pra
// nunca duplicar um item já existente por causa de maiúscula/minúscula
// ou de alguém esquecer de vincular numa segunda compra, confere por
// nome exato (sem diferenciar caixa) antes de criar — ver PRD_compras.md
// seção 16.6 pro caso real que motivou essa checagem.
async function resolveOrCreateInventoryItemId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  item: ExpenseItemInput
): Promise<{ id: string | null; error?: string }> {
  if (item.inventory_item_id) return { id: item.inventory_item_id };
  if (!item.new_item) return { id: null };

  const name = item.description.trim();
  if (!name) return { id: null };

  const { data: existing } = await supabase.from("inventory_items").select("id").ilike("name", name).maybeSingle();
  if (existing) return { id: existing.id as string };

  const { data: created, error } = await supabase
    .from("inventory_items")
    .insert({
      name,
      unit: item.new_item.unit || "un",
      turnover_group_id: item.new_item.turnover_group_id || null,
    })
    .select("id")
    .single();
  if (error || !created) return { id: null, error: error?.message ?? "Erro ao criar item de estoque." };

  const categoryIds = item.new_item.category_ids.filter(Boolean);
  if (categoryIds.length > 0) {
    const { error: catError } = await supabase
      .from("inventory_item_categories")
      .insert(categoryIds.map((category_id) => ({ inventory_item_id: created.id as string, category_id })));
    if (catError) return { id: null, error: catError.message };
  }

  return { id: created.id as string };
}

// Cria uma despesa (com ou sem linhas de item, com ou sem foto de
// recibo). Se algum item tiver inventory_item_id preenchido, a entrada de
// estoque correspondente é gerada sozinha por um trigger no banco (ver
// create_movement_from_expense_item em schema.sql) — esta action só
// grava a despesa e as linhas, nunca mexe em inventory_movements
// diretamente.
export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const date = String(formData.get("date") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const supplier_name = String(formData.get("supplier_name") ?? "").trim() || null;
  const payment_method = (String(formData.get("payment_method") ?? "").trim() || null) as PaymentMethod | null;
  const nfce_url = String(formData.get("nfce_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const receipt = formData.get("receipt");

  let items: ExpenseItemInput[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "Itens inválidos." };
  }

  const total_amount =
    items.length > 0
      ? items.reduce((sum, i) => sum + Number(i.subtotal || 0), 0)
      : Number(formData.get("total_amount") ?? 0);

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      date,
      supplier_name,
      total_amount,
      payment_method,
      nfce_url,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !expense) return { error: error?.message ?? "Erro ao criar despesa." };

  if (items.length > 0) {
    const resolvedIds: (string | null)[] = [];
    for (const i of items) {
      const resolved = await resolveOrCreateInventoryItemId(supabase, i);
      if (resolved.error) {
        await supabase.from("expenses").delete().eq("id", expense.id);
        return { error: resolved.error };
      }
      resolvedIds.push(resolved.id);
    }

    const { error: itemsError } = await supabase.from("expense_items").insert(
      items.map((i, idx) => ({
        expense_id: expense.id,
        inventory_item_id: resolvedIds[idx],
        category_id: resolvedIds[idx] ? null : i.category_id,
        description: i.description,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.subtotal,
      }))
    );
    if (itemsError) {
      // Desfaz a despesa já criada pra não deixar um cabeçalho sem linhas
      // por causa de um erro no meio do caminho.
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: itemsError.message };
    }
  }

  if (receipt instanceof File && receipt.size > 0) {
    try {
      const path = await uploadExpenseReceipt(expense.id, receipt);
      await supabase.from("expenses").update({ receipt_storage_path: path }).eq("id", expense.id);
    } catch (e) {
      // Melhor esforço: a despesa já está salva, só o anexo da foto falhou.
      return { success: true, expenseId: expense.id as string, photoError: (e as Error).message };
    }
  }

  revalidateAll();
  return { success: true, expenseId: expense.id as string };
}

// Edita uma despesa já lançada (admin only, ver RLS "expenses_admin_update").
// As linhas de item são sempre apagadas e recriadas do zero (nunca
// "diffadas") — como inventory_movements.reference_expense_item_id tem
// `on delete cascade`, apagar as linhas antigas já desfaz sozinho a
// entrada de estoque original, e recriá-las gera uma entrada nova com a
// quantidade corrigida, via o mesmo trigger de sempre. Mais simples e
// mais seguro que tentar ajustar quantidades em cima da entrada antiga.
export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const supplier_name = String(formData.get("supplier_name") ?? "").trim() || null;
  const payment_method = (String(formData.get("payment_method") ?? "").trim() || null) as PaymentMethod | null;
  const nfce_url = String(formData.get("nfce_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const receipt = formData.get("receipt");

  let items: ExpenseItemInput[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "Itens inválidos." };
  }

  const total_amount =
    items.length > 0
      ? items.reduce((sum, i) => sum + Number(i.subtotal || 0), 0)
      : Number(formData.get("total_amount") ?? 0);

  const { error: updateError } = await supabase
    .from("expenses")
    .update({ date, supplier_name, total_amount, payment_method, nfce_url, notes })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  const { error: deleteItemsError } = await supabase.from("expense_items").delete().eq("expense_id", id);
  if (deleteItemsError) return { error: deleteItemsError.message };

  if (items.length > 0) {
    const resolvedIds: (string | null)[] = [];
    for (const i of items) {
      const resolved = await resolveOrCreateInventoryItemId(supabase, i);
      if (resolved.error) return { error: resolved.error };
      resolvedIds.push(resolved.id);
    }

    const { error: itemsError } = await supabase.from("expense_items").insert(
      items.map((i, idx) => ({
        expense_id: id,
        inventory_item_id: resolvedIds[idx],
        category_id: resolvedIds[idx] ? null : i.category_id,
        description: i.description,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.subtotal,
      }))
    );
    if (itemsError) return { error: itemsError.message };
  }

  if (receipt instanceof File && receipt.size > 0) {
    try {
      const path = await uploadExpenseReceipt(id, receipt);
      await supabase.from("expenses").update({ receipt_storage_path: path }).eq("id", id);
    } catch (e) {
      return { success: true, photoError: (e as Error).message };
    }
  }

  revalidateAll();
  return { success: true };
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export interface ExpenseWithItems {
  id: string;
  date: string;
  supplier_name: string | null;
  payment_method: PaymentMethod | null;
  nfce_url: string | null;
  notes: string | null;
  total_amount: number;
  receipt_url: string | null;
  items: ExpenseItemInput[];
}

export async function getExpenseWithItems(id: string): Promise<ExpenseWithItems | null> {
  const supabase = await createClient();
  const { data: expense } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  if (!expense) return null;

  const { data: items } = await supabase
    .from("expense_items")
    .select("description, quantity, unit_cost, subtotal, inventory_item_id, category_id")
    .eq("expense_id", id)
    .order("created_at");

  return {
    id: expense.id,
    date: expense.date,
    supplier_name: expense.supplier_name,
    payment_method: expense.payment_method,
    nfce_url: expense.nfce_url,
    notes: expense.notes,
    total_amount: Number(expense.total_amount),
    receipt_url: expense.receipt_storage_path ? await signExpenseReceiptUrl(expense.receipt_storage_path) : null,
    items: (items ?? []) as ExpenseItemInput[],
  };
}

// Categoria(s) de gasto de uma despesa, pra exibição — derivadas dos
// itens ligados a item de estoque (Parte 19: a despesa em si não tem mais
// categoria própria, já que pode ter itens de categorias diferentes).
// "Sem categoria" cobre despesa sem item nenhum, item sem vínculo de
// estoque, ou item vinculado mas ainda sem nenhuma categoria escolhida.
async function getCategoryNamesByExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (expenseIds.length === 0) return result;

  const { data } = await supabase
    .from("expense_items")
    .select("expense_id, inventory_item_id")
    .in("expense_id", expenseIds)
    .not("inventory_item_id", "is", null);
  type Raw = { expense_id: string; inventory_item_id: string };
  const rows = (data ?? []) as unknown as Raw[];
  const itemIds = [...new Set(rows.map((r) => r.inventory_item_id))];
  if (itemIds.length === 0) return result;

  const { data: links } = await supabase
    .from("inventory_item_categories")
    .select("inventory_item_id, expense_categories(name)")
    .in("inventory_item_id", itemIds);
  type LinkRaw = { inventory_item_id: string; expense_categories: { name: string } | null };
  const namesByItem = new Map<string, Set<string>>();
  ((links ?? []) as unknown as LinkRaw[]).forEach((l) => {
    if (!l.expense_categories?.name) return;
    const set = namesByItem.get(l.inventory_item_id) ?? new Set<string>();
    set.add(l.expense_categories.name);
    namesByItem.set(l.inventory_item_id, set);
  });

  const setsByExpense = new Map<string, Set<string>>();
  rows.forEach((r) => {
    const set = setsByExpense.get(r.expense_id) ?? new Set<string>();
    (namesByItem.get(r.inventory_item_id) ?? new Set<string>()).forEach((n) => set.add(n));
    setsByExpense.set(r.expense_id, set);
  });
  setsByExpense.forEach((set, expenseId) => result.set(expenseId, Array.from(set)));
  return result;
}

export interface ExpenseListRow {
  id: string;
  date: string;
  category_name: string;
  supplier_name: string | null;
  total_amount: number;
  payment_method: PaymentMethod | null;
  receipt_url: string | null;
  nfce_url: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export async function getExpenses(from: string, to: string): Promise<ExpenseListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select(
      "id, date, supplier_name, total_amount, payment_method, receipt_storage_path, nfce_url, notes, created_at, created_by_profile:profiles(name)"
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  type Raw = {
    id: string;
    date: string;
    supplier_name: string | null;
    total_amount: number;
    payment_method: PaymentMethod | null;
    receipt_storage_path: string | null;
    nfce_url: string | null;
    notes: string | null;
    created_at: string;
    created_by_profile: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  const categoryNamesByExpense = await getCategoryNamesByExpense(supabase, rows.map((r) => r.id));

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      date: r.date,
      category_name: (categoryNamesByExpense.get(r.id) ?? []).join(" / ") || "Sem categoria",
      supplier_name: r.supplier_name,
      total_amount: Number(r.total_amount),
      payment_method: r.payment_method,
      receipt_url: r.receipt_storage_path ? await signExpenseReceiptUrl(r.receipt_storage_path) : null,
      nfce_url: r.nfce_url,
      notes: r.notes,
      created_by_name: r.created_by_profile?.name ?? "—",
      created_at: r.created_at,
    }))
  );
}

export interface ExpenseCategorySummaryRow {
  category_name: string;
  total: number;
}

// Soma por categoria de gasto, derivada dos ITENS de cada despesa (Parte
// 19) — um item em 2 categorias soma o próprio subtotal (não o total da
// despesa inteira) nas duas. Itens sem vínculo de estoque, ou despesas
// sem item nenhum, caem em "Sem categoria".
export async function getExpenseSummaryByCategory(from: string, to: string): Promise<ExpenseCategorySummaryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_items")
    .select("subtotal, inventory_item_id, expenses!inner(date)")
    .gte("expenses.date", from)
    .lte("expenses.date", to);

  type Raw = { subtotal: number; inventory_item_id: string | null };
  const rows = (data ?? []) as unknown as Raw[];
  const itemIds = [...new Set(rows.filter((r) => r.inventory_item_id).map((r) => r.inventory_item_id as string))];

  const { data: links } = await supabase
    .from("inventory_item_categories")
    .select("inventory_item_id, expense_categories(name)")
    .in("inventory_item_id", itemIds.length > 0 ? itemIds : ["00000000-0000-0000-0000-000000000000"]);
  type LinkRaw = { inventory_item_id: string; expense_categories: { name: string } | null };
  const categoriesByItem = new Map<string, string[]>();
  ((links ?? []) as unknown as LinkRaw[]).forEach((l) => {
    if (!l.expense_categories?.name) return;
    const names = categoriesByItem.get(l.inventory_item_id) ?? [];
    names.push(l.expense_categories.name);
    categoriesByItem.set(l.inventory_item_id, names);
  });

  const byCategory = new Map<string, number>();
  rows.forEach((r) => {
    const names = r.inventory_item_id ? categoriesByItem.get(r.inventory_item_id) ?? [] : [];
    const targets = names.length > 0 ? names : ["Sem categoria"];
    targets.forEach((name) => byCategory.set(name, (byCategory.get(name) ?? 0) + Number(r.subtotal)));
  });

  return Array.from(byCategory.entries())
    .map(([category_name, total]) => ({ category_name, total }))
    .sort((a, b) => b.total - a.total);
}

export interface ExpenseSupplierSummaryRow {
  supplier_name: string;
  total: number;
}

export async function getExpenseSummaryBySupplier(from: string, to: string): Promise<ExpenseSupplierSummaryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("supplier_name, total_amount").gte("date", from).lte("date", to);

  const bySupplier = new Map<string, number>();
  (data ?? []).forEach((r) => {
    const name = r.supplier_name?.trim() || "Sem fornecedor";
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + Number(r.total_amount));
  });

  return Array.from(bySupplier.entries())
    .map(([supplier_name, total]) => ({ supplier_name, total }))
    .sort((a, b) => b.total - a.total);
}

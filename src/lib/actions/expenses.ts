"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { uploadExpenseReceipt, signExpenseReceiptUrl } from "@/lib/expense-receipts";
import type { PaymentMethod } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/dashboard");
}

export interface ExpenseItemInput {
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  inventory_item_id: string | null;
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
  const category_id = String(formData.get("category_id") ?? "");
  const supplier_name = String(formData.get("supplier_name") ?? "").trim() || null;
  const payment_method = (String(formData.get("payment_method") ?? "").trim() || null) as PaymentMethod | null;
  const nfce_url = String(formData.get("nfce_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const receipt = formData.get("receipt");

  if (!category_id) return { error: "Selecione a categoria." };

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
      category_id,
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
    const { error: itemsError } = await supabase.from("expense_items").insert(
      items.map((i) => ({
        expense_id: expense.id,
        inventory_item_id: i.inventory_item_id || null,
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
  const category_id = String(formData.get("category_id") ?? "");
  const supplier_name = String(formData.get("supplier_name") ?? "").trim() || null;
  const payment_method = (String(formData.get("payment_method") ?? "").trim() || null) as PaymentMethod | null;
  const nfce_url = String(formData.get("nfce_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const receipt = formData.get("receipt");

  if (!category_id) return { error: "Selecione a categoria." };

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
    .update({ date, category_id, supplier_name, total_amount, payment_method, nfce_url, notes })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  const { error: deleteItemsError } = await supabase.from("expense_items").delete().eq("expense_id", id);
  if (deleteItemsError) return { error: deleteItemsError.message };

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("expense_items").insert(
      items.map((i) => ({
        expense_id: id,
        inventory_item_id: i.inventory_item_id || null,
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
  category_id: string;
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
    .select("description, quantity, unit_cost, subtotal, inventory_item_id")
    .eq("expense_id", id)
    .order("created_at");

  return {
    id: expense.id,
    date: expense.date,
    category_id: expense.category_id,
    supplier_name: expense.supplier_name,
    payment_method: expense.payment_method,
    nfce_url: expense.nfce_url,
    notes: expense.notes,
    total_amount: Number(expense.total_amount),
    receipt_url: expense.receipt_storage_path ? await signExpenseReceiptUrl(expense.receipt_storage_path) : null,
    items: (items ?? []) as ExpenseItemInput[],
  };
}

export interface ExpenseListRow {
  id: string;
  date: string;
  category_id: string;
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

export async function getExpenses(from: string, to: string, categoryId?: string): Promise<ExpenseListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(
      "id, date, category_id, supplier_name, total_amount, payment_method, receipt_storage_path, nfce_url, notes, created_at, expense_categories(name), created_by_profile:profiles(name)"
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (categoryId) query = query.eq("category_id", categoryId);

  const { data } = await query;
  type Raw = {
    id: string;
    date: string;
    category_id: string;
    supplier_name: string | null;
    total_amount: number;
    payment_method: PaymentMethod | null;
    receipt_storage_path: string | null;
    nfce_url: string | null;
    notes: string | null;
    created_at: string;
    expense_categories: { name: string } | null;
    created_by_profile: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      date: r.date,
      category_id: r.category_id,
      category_name: r.expense_categories?.name ?? "—",
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
  category_id: string;
  category_name: string;
  total: number;
}

export async function getExpenseSummaryByCategory(from: string, to: string): Promise<ExpenseCategorySummaryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("category_id, total_amount, expense_categories(name)")
    .gte("date", from)
    .lte("date", to);

  type Raw = { category_id: string; total_amount: number; expense_categories: { name: string } | null };
  const rows = (data ?? []) as unknown as Raw[];

  const byCategory = new Map<string, ExpenseCategorySummaryRow>();
  rows.forEach((r) => {
    const entry = byCategory.get(r.category_id) ?? {
      category_id: r.category_id,
      category_name: r.expense_categories?.name ?? "—",
      total: 0,
    };
    entry.total += Number(r.total_amount);
    byCategory.set(r.category_id, entry);
  });

  return Array.from(byCategory.values()).sort((a, b) => b.total - a.total);
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

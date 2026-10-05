"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { uploadExpenseReceipt, signExpenseReceiptUrl } from "@/lib/expense-receipts";
import type { PaymentMethod } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/custos-despesas", "layout");
  revalidatePath("/ativo-permanente", "layout");
  revalidatePath("/checklists", "layout");
  revalidatePath("/dashboard");
}

export interface ExpenseItemInput {
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  // Linha já ligada a um item de custo existente.
  cost_item_id: string | null;
  // Linha que cria um item de custo novo na hora (Plano de Contas) —
  // ver resolveOrCreateCostItemId.
  new_cost_item?: {
    name: string;
    is_inventory: boolean;
    inventory_item_id: string | null;
    subcenter_links: { subcenter_id: string; alloc_pct: number }[];
  } | null;
  // Linha de ativo permanente — cria 1 bem novo (cada compra é uma
  // unidade física própria, nunca reaproveita um bem já existente).
  new_fixed_asset?: {
    category_id: string;
    catalog_item_id: string | null;
    brand: string | null;
    model: string | null;
    warranty_until: string | null;
    location: string | null;
    notes: string | null;
  } | null;
  // Linha que já estava ligada a um bem de ativo permanente (edição de
  // uma despesa já salva) — atualiza o bem existente em vez de criar um
  // novo a cada edição.
  existing_fixed_asset_id?: string | null;
}

// Resolve o item de custo de uma linha: usa o vinculado (se houver) ou
// cria um novo (se pedido), incluindo o item de estoque por trás dele
// quando representa estoque. Pra nunca duplicar um item de estoque já
// existente por causa de maiúscula/minúscula, confere por nome exato
// antes de criar (ver PRD_compras.md seção 16.6).
async function resolveOrCreateCostItemId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  item: ExpenseItemInput
): Promise<{ id: string | null; error?: string }> {
  if (item.cost_item_id) return { id: item.cost_item_id };
  if (!item.new_cost_item) return { id: null };

  const name = item.new_cost_item.name.trim() || item.description.trim();
  if (!name) return { id: null };

  let inventoryItemId: string | null = null;
  if (item.new_cost_item.is_inventory) {
    if (item.new_cost_item.inventory_item_id) {
      inventoryItemId = item.new_cost_item.inventory_item_id;
    } else {
      const { data: existing } = await supabase.from("inventory_items").select("id").ilike("name", name).maybeSingle();
      if (existing) {
        inventoryItemId = existing.id as string;
      } else {
        const { data: created, error } = await supabase.from("inventory_items").insert({ name, unit: "un" }).select("id").single();
        if (error || !created) return { id: null, error: error?.message ?? "Erro ao criar item de estoque." };
        inventoryItemId = created.id as string;
      }
    }
  }

  const links = item.new_cost_item.subcenter_links.filter((l) => l.subcenter_id);
  if (links.length > 0) {
    const sum = links.reduce((s, l) => s + l.alloc_pct, 0);
    if (sum !== 100) return { id: null, error: `Os percentuais dos subcentros do novo item de custo precisam somar 100% (soma atual: ${sum}%).` };
  }

  const { data: createdItem, error: itemError } = await supabase
    .from("cost_items")
    .insert({ name, is_inventory: item.new_cost_item.is_inventory, inventory_item_id: inventoryItemId })
    .select("id")
    .single();
  if (itemError || !createdItem) return { id: null, error: itemError?.message ?? "Erro ao criar item de custo." };

  if (links.length > 0) {
    const { error: linkError } = await supabase
      .from("cost_item_subcenters")
      .insert(links.map((l) => ({ cost_item_id: createdItem.id, subcenter_id: l.subcenter_id, alloc_pct: l.alloc_pct })));
    if (linkError) return { id: null, error: linkError.message };
  }

  return { id: createdItem.id as string };
}

// Resolve o bem de ativo permanente de uma linha: atualiza o já
// existente (edição de uma despesa já salva, nunca cria um bem novo
// nesse caso) ou cria 1 bem novo (linha nova de ativo permanente).
async function upsertFixedAssetForLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  item: ExpenseItemInput,
  date: string,
  supplierName: string | null,
  userId: string | null
): Promise<{ id: string | null; error?: string }> {
  if (item.existing_fixed_asset_id) {
    const { error } = await supabase
      .from("fixed_assets")
      .update({ name: item.description.trim(), purchase_value: item.subtotal })
      .eq("id", item.existing_fixed_asset_id);
    if (error) return { id: null, error: error.message };
    return { id: item.existing_fixed_asset_id };
  }

  if (!item.new_fixed_asset) return { id: null };
  const { data, error } = await supabase
    .from("fixed_assets")
    .insert({
      category_id: item.new_fixed_asset.category_id,
      catalog_item_id: item.new_fixed_asset.catalog_item_id,
      name: item.description.trim(),
      brand: item.new_fixed_asset.brand,
      model: item.new_fixed_asset.model,
      purchase_date: date,
      purchase_value: item.subtotal,
      warranty_until: item.new_fixed_asset.warranty_until,
      supplier_name: supplierName,
      location: item.new_fixed_asset.location,
      notes: item.new_fixed_asset.notes,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Erro ao registrar o ativo permanente." };
  return { id: data.id as string };
}

async function resolveExpenseItemsForInsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: ExpenseItemInput[],
  date: string,
  supplierName: string | null,
  userId: string | null
): Promise<{ rows?: Record<string, unknown>[]; error?: string }> {
  const rows: Record<string, unknown>[] = [];
  for (const i of items) {
    let costItemId: string | null = null;
    let fixedAssetId: string | null = null;

    if (i.existing_fixed_asset_id || i.new_fixed_asset) {
      const resolved = await upsertFixedAssetForLine(supabase, i, date, supplierName, userId);
      if (resolved.error) return { error: resolved.error };
      fixedAssetId = resolved.id;
    } else {
      const resolved = await resolveOrCreateCostItemId(supabase, i);
      if (resolved.error) return { error: resolved.error };
      costItemId = resolved.id;
    }

    rows.push({
      cost_item_id: costItemId,
      fixed_asset_id: fixedAssetId,
      description: i.description,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.subtotal,
    });
  }
  return { rows };
}

// Cria uma despesa (com ou sem linhas de item, com ou sem foto de
// recibo). Se algum item tiver cost_item_id (ligado a estoque), a entrada
// de estoque correspondente é gerada sozinha por um trigger no banco (ver
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
    .insert({ date, supplier_name, total_amount, payment_method, nfce_url, notes, created_by: user.id })
    .select("id")
    .single();

  if (error || !expense) return { error: error?.message ?? "Erro ao criar despesa." };

  if (items.length > 0) {
    const resolved = await resolveExpenseItemsForInsert(supabase, items, date, supplier_name, user.id);
    if (resolved.error || !resolved.rows) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: resolved.error ?? "Erro ao resolver os itens da despesa." };
    }

    const { error: itemsError } = await supabase
      .from("expense_items")
      .insert(resolved.rows.map((r) => ({ ...r, expense_id: expense.id })));
    if (itemsError) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: itemsError.message };
    }
  }

  if (receipt instanceof File && receipt.size > 0) {
    try {
      const path = await uploadExpenseReceipt(expense.id, receipt);
      await supabase.from("expenses").update({ receipt_storage_path: path }).eq("id", expense.id);
    } catch (e) {
      return { success: true, expenseId: expense.id as string, photoError: (e as Error).message };
    }
  }

  revalidateAll();
  return { success: true, expenseId: expense.id as string };
}

// Edita uma despesa já lançada (admin only). As linhas de item são sempre
// apagadas e recriadas do zero (nunca "diffadas") — como
// inventory_movements.reference_expense_item_id tem `on delete cascade`,
// apagar as linhas antigas já desfaz sozinho a entrada de estoque
// original, e recriá-las gera uma entrada nova com a quantidade
// corrigida, via o mesmo trigger de sempre.
export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    const resolved = await resolveExpenseItemsForInsert(supabase, items, date, supplier_name, user?.id ?? null);
    if (resolved.error || !resolved.rows) return { error: resolved.error ?? "Erro ao resolver os itens da despesa." };

    const { error: itemsError } = await supabase
      .from("expense_items")
      .insert(resolved.rows.map((r) => ({ ...r, expense_id: id })));
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
  items: {
    description: string;
    quantity: number;
    unit_cost: number;
    subtotal: number;
    cost_item_id: string | null;
    fixed_asset_id: string | null;
    fixed_asset_name: string | null;
  }[];
}

export async function getExpenseWithItems(id: string): Promise<ExpenseWithItems | null> {
  const supabase = await createClient();
  const { data: expense } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  if (!expense) return null;

  const { data: items } = await supabase
    .from("expense_items")
    .select("description, quantity, unit_cost, subtotal, cost_item_id, fixed_asset_id, fixed_assets(name)")
    .eq("expense_id", id)
    .order("created_at");

  type Raw = {
    description: string;
    quantity: number;
    unit_cost: number;
    subtotal: number;
    cost_item_id: string | null;
    fixed_asset_id: string | null;
    fixed_assets: { name: string } | null;
  };

  return {
    id: expense.id,
    date: expense.date,
    supplier_name: expense.supplier_name,
    payment_method: expense.payment_method,
    nfce_url: expense.nfce_url,
    notes: expense.notes,
    total_amount: Number(expense.total_amount),
    receipt_url: expense.receipt_storage_path ? await signExpenseReceiptUrl(expense.receipt_storage_path) : null,
    items: ((items ?? []) as unknown as Raw[]).map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.subtotal,
      cost_item_id: i.cost_item_id,
      fixed_asset_id: i.fixed_asset_id,
      fixed_asset_name: i.fixed_assets?.name ?? null,
    })),
  };
}

// Nomes dos CENTROS de custo a que as linhas de uma despesa pertencem
// (via item de custo → subcentro → centro) — pra exibição no Histórico.
// "Ativo permanente" cobre linhas de bem permanente; "Sem item" cobre
// despesa sem nenhuma linha (valor total só).
async function getCenterNamesByExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (expenseIds.length === 0) return result;

  const { data } = await supabase
    .from("expense_items")
    .select("expense_id, cost_item_id, fixed_asset_id")
    .in("expense_id", expenseIds);
  type Raw = { expense_id: string; cost_item_id: string | null; fixed_asset_id: string | null };
  const rows = (data ?? []) as unknown as Raw[];
  const costItemIds = [...new Set(rows.filter((r) => r.cost_item_id).map((r) => r.cost_item_id as string))];

  const { data: links } = costItemIds.length
    ? await supabase
        .from("cost_item_subcenters")
        .select("cost_item_id, cost_subcenters(cost_subcenter_centers(cost_centers(name)))")
        .in("cost_item_id", costItemIds)
    : { data: [] };
  type LinkRaw = {
    cost_item_id: string;
    cost_subcenters: { cost_subcenter_centers: { cost_centers: { name: string } | null }[] } | null;
  };
  const centersByCostItem = new Map<string, Set<string>>();
  ((links ?? []) as unknown as LinkRaw[]).forEach((l) => {
    const set = centersByCostItem.get(l.cost_item_id) ?? new Set<string>();
    l.cost_subcenters?.cost_subcenter_centers.forEach((csc) => {
      if (csc.cost_centers?.name) set.add(csc.cost_centers.name);
    });
    centersByCostItem.set(l.cost_item_id, set);
  });

  const setsByExpense = new Map<string, Set<string>>();
  rows.forEach((r) => {
    const set = setsByExpense.get(r.expense_id) ?? new Set<string>();
    if (r.fixed_asset_id) set.add("Ativo permanente");
    if (r.cost_item_id) (centersByCostItem.get(r.cost_item_id) ?? []).forEach((n) => set.add(n));
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
  const centerNamesByExpense = await getCenterNamesByExpense(supabase, rows.map((r) => r.id));

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      date: r.date,
      category_name: (centerNamesByExpense.get(r.id) ?? []).join(" / ") || "Sem categoria",
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

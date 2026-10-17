"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ProductCategory, ProductType, UnitConversion } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidateAll() {
  revalidatePath("/contabil", "layout");
  revalidatePath("/checklists", "layout");
  revalidatePath("/compras", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/estoque", "layout");
  revalidatePath("/dashboard");
}

// ---------- Categorias de produto ----------

export async function getProductCategories(): Promise<ProductCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("product_categories").select("*").order("position").order("name");
  return (data ?? []) as ProductCategory[];
}

export async function createProductCategory(name: string) {
  if (!name.trim()) return { error: "Informe o nome da categoria." };
  const supabase = await createClient();
  const { data: max } = await supabase.from("product_categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("product_categories").insert({ name: name.trim(), position: (max?.position ?? 0) + 1 });
  if (error) return { error: error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message };
  revalidateAll();
  return { success: true };
}

export async function updateProductCategory(id: string, name: string, active: boolean) {
  if (!name.trim()) return { error: "Informe o nome da categoria." };
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").update({ name: name.trim(), active }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message };
  revalidateAll();
  return { success: true };
}

// Categoria em uso nunca é apagada (o PRD manda desativar, não excluir,
// o que tem histórico) — só uma categoria sem nenhum produto.
export async function deleteProductCategory(id: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("cost_items").select("id", { count: "exact", head: true }).eq("category_id", id);
  if ((count ?? 0) > 0) return { error: "Esta categoria tem produtos. Desative-a em vez de excluir." };
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// ---------- Produtos ----------

export interface ProductRow {
  id: string; // id do item de custo
  name: string;
  sku: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  product_type: ProductType | null;
  active: boolean;
  ledger_account_code: string | null;
  controls_stock: boolean;
  inventory_item_id: string | null;
  unit: string;
  barcode: string | null;
  reorder_point: number;
  coverage_days: number;
  shelf_life_days: number | null;
  expiry_alert_days: number;
  is_perishable: boolean;
  conversions: UnitConversion[];
  centers: { center_id: string; center_name: string; alloc_pct: number }[];
  balance: number;
  avg_cost: number;
  stock_value: number;
  // Compras ou movimentos de estoque no histórico — trava exclusão e
  // troca da unidade-base (só desativar).
  has_history: boolean;
}

export async function getProducts(): Promise<ProductRow[]> {
  const supabase = await createClient();
  const [{ data: items }, { data: links }, { data: convs }, { data: balances }, { data: purchased }, { data: moved }] =
    await Promise.all([
      supabase
        .from("cost_items")
        .select("*, product_categories(name), inventory_items(*)")
        .eq("is_product", true)
        .order("name"),
      supabase.from("cost_item_centers").select("cost_item_id, center_id, alloc_pct, cost_centers(name)"),
      supabase.from("inventory_item_unit_conversions").select("inventory_item_id, unit_name, factor").order("created_at"),
      supabase.from("inventory_balances").select("inventory_item_id, balance, value, avg_cost"),
      supabase.from("expense_items").select("cost_item_id").not("cost_item_id", "is", null),
      supabase.from("inventory_movements").select("inventory_item_id"),
    ]);

  type Raw = {
    id: string;
    name: string;
    sku: string | null;
    description: string | null;
    category_id: string | null;
    product_type: ProductType | null;
    active: boolean;
    ledger_account_code: string | null;
    inventory_item_id: string | null;
    product_categories: { name: string } | null;
    inventory_items: {
      unit: string;
      barcode: string | null;
      reorder_point: number;
      coverage_days: number;
      shelf_life_days: number | null;
      expiry_alert_days: number;
      is_perishable: boolean;
    } | null;
  };

  const centersByItem = new Map<string, ProductRow["centers"]>();
  ((links ?? []) as unknown as { cost_item_id: string; center_id: string; alloc_pct: number; cost_centers: { name: string } | null }[]).forEach((l) => {
    const list = centersByItem.get(l.cost_item_id) ?? [];
    list.push({ center_id: l.center_id, center_name: l.cost_centers?.name ?? "—", alloc_pct: Number(l.alloc_pct) });
    centersByItem.set(l.cost_item_id, list);
  });
  const convByInv = new Map<string, UnitConversion[]>();
  ((convs ?? []) as { inventory_item_id: string; unit_name: string; factor: number }[]).forEach((c) => {
    const list = convByInv.get(c.inventory_item_id) ?? [];
    list.push({ unit_name: c.unit_name, factor: Number(c.factor) });
    convByInv.set(c.inventory_item_id, list);
  });
  const balByInv = new Map(((balances ?? []) as { inventory_item_id: string; balance: number; value: number; avg_cost: number }[]).map((b) => [b.inventory_item_id, b]));
  const purchasedCostItems = new Set(((purchased ?? []) as { cost_item_id: string }[]).map((p) => p.cost_item_id));
  const movedInv = new Set(((moved ?? []) as { inventory_item_id: string }[]).map((m) => m.inventory_item_id));

  return ((items ?? []) as unknown as Raw[]).map((i) => {
    const inv = i.inventory_items;
    const b = i.inventory_item_id ? balByInv.get(i.inventory_item_id) : undefined;
    return {
      id: i.id,
      name: i.name,
      sku: i.sku,
      description: i.description,
      category_id: i.category_id,
      category_name: i.product_categories?.name ?? null,
      product_type: i.product_type,
      active: i.active,
      ledger_account_code: i.ledger_account_code,
      controls_stock: !!i.inventory_item_id,
      inventory_item_id: i.inventory_item_id,
      unit: inv?.unit ?? "un",
      barcode: inv?.barcode ?? null,
      reorder_point: Number(inv?.reorder_point ?? 0),
      coverage_days: inv?.coverage_days ?? 7,
      shelf_life_days: inv?.shelf_life_days ?? null,
      expiry_alert_days: inv?.expiry_alert_days ?? 7,
      is_perishable: inv?.is_perishable ?? false,
      conversions: i.inventory_item_id ? (convByInv.get(i.inventory_item_id) ?? []) : [],
      centers: centersByItem.get(i.id) ?? [],
      balance: b ? Number(b.balance) : 0,
      avg_cost: b ? Number(b.avg_cost) : 0,
      stock_value: b ? Number(b.value) : 0,
      has_history: purchasedCostItems.has(i.id) || (!!i.inventory_item_id && movedInv.has(i.inventory_item_id)),
    };
  });
}

// Itens de custo que ainda NÃO são produtos — candidatos a "promover".
export async function getNonProductCostItems(): Promise<{ id: string; name: string; centers: ProductRow["centers"] }[]> {
  const supabase = await createClient();
  const [{ data: items }, { data: links }] = await Promise.all([
    supabase.from("cost_items").select("id, name").eq("is_product", false).eq("active", true).order("name"),
    supabase.from("cost_item_centers").select("cost_item_id, center_id, alloc_pct, cost_centers(name)"),
  ]);
  const centersByItem = new Map<string, ProductRow["centers"]>();
  ((links ?? []) as unknown as { cost_item_id: string; center_id: string; alloc_pct: number; cost_centers: { name: string } | null }[]).forEach((l) => {
    const list = centersByItem.get(l.cost_item_id) ?? [];
    list.push({ center_id: l.center_id, center_name: l.cost_centers?.name ?? "—", alloc_pct: Number(l.alloc_pct) });
    centersByItem.set(l.cost_item_id, list);
  });
  return ((items ?? []) as { id: string; name: string }[]).map((i) => ({ ...i, centers: centersByItem.get(i.id) ?? [] }));
}

export interface ProductInput {
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string | null;
  productType: ProductType | null;
  active: boolean;
  ledgerAccountCode: string | null;
  centerLinks: { center_id: string; alloc_pct: number }[];
  controlsStock: boolean;
  // Só valem quando controlsStock:
  unit: string;
  barcode: string | null;
  conversions: UnitConversion[];
  reorderPoint: number;
  coverageDays: number;
  shelfLifeDays: number | null;
  expiryAlertDays: number;
  isPerishable: boolean;
  // Só na criação: começar a partir de um item de custo que ainda não é produto.
  promoteFromId?: string | null;
}

function validate(input: ProductInput): string | null {
  if (!input.name.trim()) return "Informe o nome do produto.";
  if (input.centerLinks.length === 0) return "Ligue o produto a pelo menos 1 centro de custo.";
  const sum = input.centerLinks.reduce((s, l) => s + l.alloc_pct, 0);
  if (sum !== 100) return `Os percentuais dos centros precisam somar 100% (soma atual: ${sum}%).`;
  if (input.controlsStock) {
    if (!input.unit.trim()) return "Informe a unidade-base do produto.";
    const seen = new Set([input.unit.trim().toLowerCase()]);
    for (const c of input.conversions) {
      if (!c.unit_name.trim() || !(Number(c.factor) > 0)) return "Cada conversão precisa de um nome de unidade e de um fator maior que zero.";
      if (seen.has(c.unit_name.trim().toLowerCase())) return `A unidade "${c.unit_name}" está repetida (ou igual à unidade-base).`;
      seen.add(c.unit_name.trim().toLowerCase());
    }
    if (!(input.coverageDays >= 1)) return "Os dias de folga precisam ser pelo menos 1.";
    if (input.shelfLifeDays !== null && input.shelfLifeDays <= 0) return "O prazo de validade precisa ser maior que zero (ou fica em branco).";
  }
  return null;
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("sku")) return "Já existe um produto com esse código/SKU.";
    if (error.message.includes("barcode")) return "Já existe um produto com esse código de barras.";
    return "Já existe um produto com esse nome ou código.";
  }
  return error.message;
}

async function replaceCenterLinks(supabase: Supabase, costItemId: string, links: ProductInput["centerLinks"]) {
  await supabase.from("cost_item_centers").delete().eq("cost_item_id", costItemId);
  const { error } = await supabase
    .from("cost_item_centers")
    .insert(links.map((l) => ({ cost_item_id: costItemId, center_id: l.center_id, alloc_pct: l.alloc_pct })));
  return error ? friendly(error) : null;
}

async function replaceConversions(supabase: Supabase, inventoryItemId: string, conversions: UnitConversion[]) {
  await supabase.from("inventory_item_unit_conversions").delete().eq("inventory_item_id", inventoryItemId);
  if (conversions.length === 0) return null;
  const { error } = await supabase
    .from("inventory_item_unit_conversions")
    .insert(conversions.map((c) => ({ inventory_item_id: inventoryItemId, unit_name: c.unit_name.trim(), factor: c.factor })));
  return error ? friendly(error) : null;
}

function stockColumns(input: ProductInput) {
  return {
    name: input.name.trim(),
    unit: input.unit.trim(),
    barcode: input.barcode?.trim() || null,
    reorder_point: input.reorderPoint,
    coverage_days: input.coverageDays,
    shelf_life_days: input.shelfLifeDays,
    expiry_alert_days: input.expiryAlertDays,
    is_perishable: input.isPerishable,
    active: input.active,
  };
}

async function inventoryHasHistory(supabase: Supabase, inventoryItemId: string): Promise<boolean> {
  const [{ count: moves }, { count: recipes }] = await Promise.all([
    supabase.from("inventory_movements").select("id", { count: "exact", head: true }).eq("inventory_item_id", inventoryItemId),
    supabase.from("inventory_item_recipes").select("id", { count: "exact", head: true }).eq("inventory_item_id", inventoryItemId),
  ]);
  return (moves ?? 0) > 0 || (recipes ?? 0) > 0;
}

// Salva (cria ou atualiza) o item de custo + o item de estoque ligado,
// juntos — "tela única" decidida com o proprietário. Sem transação real
// (mesmo padrão das outras actions): na criação, desfaz o que já gravou
// se um passo seguinte falhar.
async function saveProduct(costItemId: string | null, input: ProductInput): Promise<{ id?: string; error?: string }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };
  const supabase = await createClient();

  let current: { inventory_item_id: string | null } | null = null;
  let id = costItemId;
  let createdNew = false;

  if (id) {
    const { data } = await supabase.from("cost_items").select("inventory_item_id").eq("id", id).maybeSingle();
    if (!data) return { error: "Produto não encontrado." };
    current = data as { inventory_item_id: string | null };
  }

  const base = {
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    description: input.description?.trim() || null,
    category_id: input.categoryId,
    product_type: input.productType,
    active: input.active,
    ledger_account_code: input.ledgerAccountCode,
    is_product: true,
  };

  if (!id) {
    const { data, error } = await supabase.from("cost_items").insert({ ...base, is_inventory: false }).select("id").single();
    if (error || !data) return { error: friendly(error ?? { message: "Erro ao criar produto." }) };
    id = data.id as string;
    createdNew = true;
    current = { inventory_item_id: null };
  } else {
    const { error } = await supabase.from("cost_items").update(base).eq("id", id);
    if (error) return { error: friendly(error) };
  }

  async function rollback(message: string) {
    if (createdNew && id) await supabase.from("cost_items").delete().eq("id", id);
    return { error: message };
  }

  let inventoryItemId = current?.inventory_item_id ?? null;

  if (input.controlsStock) {
    if (inventoryItemId) {
      // Com histórico, a unidade-base não muda (os números antigos passariam a significar outra coisa).
      const { data: inv } = await supabase.from("inventory_items").select("unit").eq("id", inventoryItemId).single();
      const cols = stockColumns(input);
      if (inv && inv.unit !== cols.unit && (await inventoryHasHistory(supabase, inventoryItemId))) {
        return { error: "Este produto já tem movimentos de estoque ou fichas técnicas — a unidade-base não pode mudar." };
      }
      const { error } = await supabase.from("inventory_items").update(cols).eq("id", inventoryItemId);
      if (error) return { error: friendly(error) };
    } else {
      const { data: inv, error } = await supabase.from("inventory_items").insert(stockColumns(input)).select("id").single();
      if (error || !inv) return rollback(friendly(error ?? { message: "Erro ao criar o item de estoque." }));
      inventoryItemId = inv.id as string;
      const { error: linkError } = await supabase
        .from("cost_items")
        .update({ is_inventory: true, inventory_item_id: inventoryItemId })
        .eq("id", id);
      if (linkError) {
        await supabase.from("inventory_items").delete().eq("id", inventoryItemId);
        return rollback(friendly(linkError));
      }
    }
    const convError = await replaceConversions(supabase, inventoryItemId!, input.conversions);
    if (convError) return { error: convError };
  } else if (inventoryItemId) {
    if (await inventoryHasHistory(supabase, inventoryItemId)) {
      return { error: "Este produto já tem movimentos de estoque ou fichas técnicas — não dá pra deixar de controlar estoque. Desative o produto, se for o caso." };
    }
    await supabase.from("cost_items").update({ is_inventory: false, inventory_item_id: null }).eq("id", id);
    await supabase.from("inventory_items").delete().eq("id", inventoryItemId);
  }

  const linkError = await replaceCenterLinks(supabase, id!, input.centerLinks);
  if (linkError) return createdNew ? rollback(linkError) : { error: linkError };

  revalidateAll();
  return { id: id! };
}

export async function createProduct(input: ProductInput) {
  if (input.promoteFromId) {
    const supabase = await createClient();
    const { data } = await supabase.from("cost_items").select("is_product").eq("id", input.promoteFromId).maybeSingle();
    if (!data) return { error: "Item de custo não encontrado." };
    if (data.is_product) return { error: "Este item de custo já é um produto." };
    return saveProduct(input.promoteFromId, input);
  }
  return saveProduct(null, input);
}

export async function updateProduct(id: string, input: ProductInput) {
  return saveProduct(id, input);
}

// Só exclui produto SEM histórico (nenhuma compra, movimento de estoque
// ou ficha técnica) — o resto, só desativar (PRD 5.1).
export async function deleteProduct(id: string) {
  const supabase = await createClient();
  const { data: item } = await supabase.from("cost_items").select("inventory_item_id").eq("id", id).maybeSingle();
  if (!item) return { error: "Produto não encontrado." };
  const { count } = await supabase.from("expense_items").select("id", { count: "exact", head: true }).eq("cost_item_id", id);
  if ((count ?? 0) > 0 || (item.inventory_item_id && (await inventoryHasHistory(supabase, item.inventory_item_id as string)))) {
    return { error: "Este produto tem histórico (compras, estoque ou fichas técnicas). Desative-o em vez de excluir." };
  }
  const { error } = await supabase.from("cost_items").delete().eq("id", id);
  if (error) return { error: error.message };
  if (item.inventory_item_id) await supabase.from("inventory_items").delete().eq("id", item.inventory_item_id as string);
  revalidateAll();
  return { success: true };
}

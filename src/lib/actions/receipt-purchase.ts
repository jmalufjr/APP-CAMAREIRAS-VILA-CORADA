"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/actions/authz";
import { createExpense } from "@/lib/actions/expenses";
import type { ExpenseItemInput } from "@/lib/actions/expenses";
import { createSupplier } from "@/lib/actions/suppliers";
import { ensureProduct, ensureAssetCatalogItem } from "@/lib/auto-catalog";
import { applyTotalAdjustment } from "@/lib/receipt-adjust";
import { isPendingPaymentMethod, SUPPLIER_PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import { addDaysKey } from "@/lib/date";

export interface ReceiptPurchaseItemInput {
  description: string;
  quantity: number;
  unit_cost: number;
  for_breakfast: boolean;
  kind: "produto" | "ativo";
  matched_cost_item_id: string | null;
  matched_asset_catalog_item_id: string | null;
  suggested_category_id: string | null;
  suggested_name: string | null;
}

export interface ReceiptPurchaseInput {
  date: string;
  supplier_name: string | null;
  document_number: string | null;
  note_total: number | null;
  payment_method: string;
  due_date: string | null;
  confirm_duplicate: boolean;
  items: ReceiptPurchaseItemInput[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Grava uma compra a partir de uma nota lida pela IA (tela "Lançar Compra"): cada item vai para
// o produto/bem já cadastrado que a IA encontrou; o que não foi encontrado é CADASTRADO AGORA
// como produto novo ou bem novo do ativo permanente (ver auto-catalog.ts) — por isso a ação
// exige o papel de quem lança (admin, gerente operacional ou funcionário de manutenção) e usa o
// client admin só para esses cadastros automáticos. A competência é sempre a data da nota.
export async function createReceiptPurchase(formData: FormData) {
  const denied = await requireRole(["admin", "gerente_operacional", "manutencao"]);
  if (denied) return denied;

  let input: ReceiptPurchaseInput;
  try {
    input = JSON.parse(String(formData.get("payload") ?? "")) as ReceiptPurchaseInput;
  } catch {
    return { error: "Dados da compra inválidos." };
  }
  const receipt = formData.get("receipt");

  if (!DATE_RE.test(input.date ?? "")) return { error: "A nota não tem uma data válida." };
  if (!SUPPLIER_PAYMENT_METHOD_OPTIONS.some((o) => o.value === input.payment_method)) {
    return { error: "Escolha a forma de pagamento." };
  }
  if (isPendingPaymentMethod(input.payment_method) && !DATE_RE.test(input.due_date ?? "")) {
    return { error: "Informe o vencimento — compra a prazo ou no cartão de crédito precisa de uma data de vencimento." };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) return { error: "A nota não tem itens." };
  for (const i of input.items) {
    if (!i.description?.trim()) return { error: "Há um item sem descrição na nota." };
    if (!(Number(i.quantity) > 0)) return { error: `Quantidade inválida no item "${i.description}".` };
    if (!(Number(i.unit_cost) >= 0)) return { error: `Preço inválido no item "${i.description}".` };
  }

  const supabase = await createClient();

  // Fornecedor: usa o cadastrado (mesmo nome) ou cadastra um novo.
  let supplierId: string | null = null;
  let supplierIsNew = false;
  const supplierName = input.supplier_name?.trim() ?? "";
  if (supplierName) {
    const { data: found } = await supabase.from("suppliers").select("id").ilike("name", supplierName).limit(1);
    if (found && found.length > 0) {
      supplierId = found[0].id as string;
    } else {
      supplierIsNew = true;
    }
  }

  // Aviso de nota repetida ANTES de cadastrar qualquer coisa nova (nunca bloqueia).
  const rowsForTotal = input.items.map((i) => round2(Number(i.quantity) * Number(i.unit_cost)));
  const itemsSum = round2(rowsForTotal.reduce((s, v) => s + v, 0));
  const expectedTotal = input.note_total && input.note_total > 0 ? input.note_total : itemsSum;
  if (!input.confirm_duplicate && input.document_number?.trim() && !supplierIsNew) {
    let query = supabase
      .from("expenses")
      .select("id")
      .eq("document_number", input.document_number.trim())
      .eq("date", input.date);
    query = supplierId ? query.eq("supplier_id", supplierId) : query.is("supplier_id", null);
    const { data: dup } = await query.limit(1);
    if (dup && dup.length > 0) {
      return {
        duplicateWarning: true as const,
        error: "Já existe uma compra com o mesmo fornecedor, número da nota e data. Tem certeza que quer lançar de novo?",
      };
    }
  }

  if (supplierIsNew) {
    const created = await createSupplier(supplierName, null, null, null, null);
    if (created.error || !created.id) return { error: created.error ?? "Erro ao cadastrar o fornecedor." };
    supplierId = created.id;
  }

  // Enquadramento de cada item.
  const admin = createAdminClient();
  const createdProducts: string[] = [];
  const createdAssets: string[] = [];
  const productCache = new Map<string, string>(); // nome normalizado -> id (itens repetidos na mesma nota)
  const resolved: ExpenseItemInput[] = [];

  const matchedIds = input.items.map((i) => i.matched_cost_item_id).filter((v): v is string => !!v);
  const shelfLife = new Map<string, number | null>();
  const recordShelfLife = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await admin.from("cost_items").select("id, inventory_items(shelf_life_days)").in("id", ids);
    (data ?? []).forEach((r) => {
      const inv = (r as unknown as { inventory_items: { shelf_life_days: number | null } | null }).inventory_items;
      shelfLife.set(r.id as string, inv?.shelf_life_days ?? null);
    });
  };
  await recordShelfLife(matchedIds);

  for (const item of input.items) {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unit_cost);
    const subtotal = round2(quantity * unitCost);
    const base = {
      description: item.description.trim(),
      quantity,
      unit_cost: unitCost,
      subtotal,
      discount: 0,
      freight_and_other_costs: 0,
      recoverable_tax: 0,
      non_recoverable_tax: 0,
    };
    const asAsset = item.kind === "ativo" && !item.for_breakfast;

    if (asAsset) {
      let categoryId: string | null = null;
      let catalogItemId: string | null = item.matched_asset_catalog_item_id;
      if (catalogItemId) {
        const { data: cat } = await admin.from("fixed_asset_catalog_items").select("category_id").eq("id", catalogItemId).maybeSingle();
        categoryId = (cat?.category_id as string | undefined) ?? null;
      }
      if (!categoryId) {
        const made = await ensureAssetCatalogItem(admin, {
          name: item.suggested_name || item.description,
          categoryId: item.suggested_category_id,
        });
        if (made.error || !made.categoryId) return { error: made.error ?? "Erro ao cadastrar o bem novo." };
        categoryId = made.categoryId;
        catalogItemId = made.catalogItemId ?? null;
        if (made.created) createdAssets.push(item.suggested_name || item.description);
      }
      resolved.push({
        ...base,
        cost_item_id: null,
        new_fixed_asset: {
          category_id: categoryId,
          catalog_item_id: catalogItemId,
          brand: null,
          model: null,
          warranty_until: null,
          location: null,
          notes: null,
        },
        existing_fixed_asset_id: null,
      });
      continue;
    }

    let costItemId = item.matched_cost_item_id;
    if (!costItemId) {
      const name = (item.suggested_name || item.description).trim();
      const key = name.toLowerCase();
      const cached = productCache.get(key);
      if (cached) {
        costItemId = cached;
      } else {
        const made = await ensureProduct(admin, { name, categoryId: item.suggested_category_id });
        if (made.error || !made.id) return { error: made.error ?? `Erro ao cadastrar o produto "${name}".` };
        costItemId = made.id;
        productCache.set(key, made.id);
        if (made.created) createdProducts.push(name);
        await recordShelfLife([made.id]);
      }
    }
    const days = costItemId ? shelfLife.get(costItemId) ?? null : null;
    resolved.push({
      ...base,
      for_breakfast: item.for_breakfast,
      expiry_date: days ? addDaysKey(input.date, days) : null,
      cost_item_id: costItemId,
      new_fixed_asset: null,
      existing_fixed_asset_id: null,
    });
  }

  // Total impresso na nota (desconto/frete) distribuído nas linhas.
  const adjusted = applyTotalAdjustment(resolved, expectedTotal);
  const total = round2(adjusted.reduce((s, r) => s + r.subtotal, 0));

  const expenseForm = new FormData();
  expenseForm.set("date", input.date);
  expenseForm.set("competence_date", input.date); // competência = data da nota, sempre
  expenseForm.set("document_number", input.document_number?.trim() ?? "");
  if (supplierId) expenseForm.set("supplier_id", supplierId);
  expenseForm.set("payment_method", input.payment_method);
  if (isPendingPaymentMethod(input.payment_method)) expenseForm.set("due_date", input.due_date ?? "");
  expenseForm.set("nfce_url", "");
  expenseForm.set("notes", "");
  expenseForm.set("total_amount", String(total));
  expenseForm.set("items", JSON.stringify(adjusted));
  expenseForm.set("confirm_duplicate", "true"); // já conferido acima
  if (receipt instanceof File && receipt.size > 0) expenseForm.set("receipt", receipt, receipt.name || "recibo");

  const result = await createExpense(expenseForm);
  if (!result || "error" in result) {
    return { error: (result && "error" in result && result.error) || "Erro ao registrar a compra." };
  }
  return {
    success: true as const,
    expenseId: result.expenseId,
    ledgerWarning: "ledgerWarning" in result ? result.ledgerWarning : undefined,
    photoError: "photoError" in result ? result.photoError : undefined,
    createdProducts,
    createdAssets,
    createdSupplier: supplierIsNew ? supplierName : null,
  };
}

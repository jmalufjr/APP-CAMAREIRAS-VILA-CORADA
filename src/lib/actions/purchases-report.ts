"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/authz";
import { updateExpense, getExpenseWithItems } from "@/lib/actions/expenses";
import type { ExpenseItemInput } from "@/lib/actions/expenses";
import { daysAgoKey, todayKey } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProduct } from "@/lib/auto-catalog";
import { previewFeiraItem } from "@/lib/actions/feira";

export interface PurchaseReportItem {
  position: number; // posição da linha na compra (ordem de criação)
  description: string;
  quantity: number;
  unit_cost: number;
  unit: string | null;
  cost_item_id: string | null;
  is_asset: boolean;
}

export interface PurchaseReportRow {
  id: string;
  date: string;
  supplier_id: string | null;
  document_number: string | null;
  items: PurchaseReportItem[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Relatório de compras: compras dos últimos 30 dias, como estão REGISTRADAS no sistema (e não
// como foram digitadas/lidas no lançamento). Compra = lançamento com pelo menos um produto ou bem.
export async function getPurchasesReport(): Promise<PurchaseReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select(
      "id, date, supplier_id, document_number, created_at, expense_items(id, description, quantity, unit_cost, cost_item_id, fixed_asset_id, created_at, cost_items(is_product, inventory_items(unit)))"
    )
    .gte("date", daysAgoKey(30))
    .lte("date", todayKey())
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  type Raw = {
    id: string;
    date: string;
    supplier_id: string | null;
    document_number: string | null;
    expense_items: {
      id: string;
      description: string;
      quantity: number;
      unit_cost: number;
      cost_item_id: string | null;
      fixed_asset_id: string | null;
      created_at: string;
      cost_items: { is_product: boolean; inventory_items: { unit: string } | null } | null;
    }[];
  };
  return ((data ?? []) as unknown as Raw[])
    .filter((e) => e.expense_items.some((i) => i.fixed_asset_id || i.cost_items?.is_product))
    .map((e) => ({
      id: e.id,
      date: e.date,
      supplier_id: e.supplier_id,
      document_number: e.document_number,
      items: [...e.expense_items]
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((i, idx) => ({
          position: idx,
          description: i.description,
          quantity: Number(i.quantity),
          unit_cost: Number(i.unit_cost),
          unit: i.cost_items?.inventory_items?.unit ?? null,
          cost_item_id: i.cost_item_id,
          is_asset: !!i.fixed_asset_id,
        })),
    }));
}

export interface PurchaseCorrection {
  id: string;
  date: string;
  supplier_id: string | null;
  document_number: string | null;
  items: { position: number; description: string; quantity: number; unit_cost: number }[];
}

// Salva só as compras que o usuário alterou. Cada uma é refeita pelo mesmo caminho da edição de
// compra (estoque e lançamento contábil são refeitos automaticamente).
export async function savePurchaseCorrections(corrections: PurchaseCorrection[]) {
  const denied = await requireRole(["admin", "gerente_operacional"]);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("cost_items")
    .select("id, name")
    .eq("is_product", true)
    .eq("active", true);
  const productByName = new Map((products ?? []).map((p) => [String(p.name).trim().toLowerCase(), p.id as string]));

  const errors: string[] = [];
  let saved = 0;

  for (const c of corrections) {
    const original = await getExpenseWithItems(c.id);
    if (!original) {
      errors.push("Uma compra não foi encontrada.");
      continue;
    }
    if (original.date < daysAgoKey(30)) {
      errors.push(`A compra de ${original.date} tem mais de 30 dias e não pode mais ser corrigida.`);
      continue;
    }

    // Nome novo numa linha de produto: cadastra o produto (categoria escolhida pela IA entre as existentes).
    for (const it of original.items.map((o, idx) => ({ o, edit: c.items.find((e) => e.position === idx) }))) {
      const name = it.edit?.description.trim();
      if (!name || it.o.fixed_asset_id || name.toLowerCase() === it.o.description.trim().toLowerCase()) continue;
      if (productByName.has(name.toLowerCase())) continue;
      const preview = await previewFeiraItem(name);
      const made = await ensureProduct(createAdminClient(), {
        name,
        categoryId: "error" in preview ? null : preview.suggested_category_id,
      });
      if (made.error || !made.id) {
        errors.push(`Compra de ${original.date}: ${made.error ?? `não foi possível cadastrar "${name}".`}`);
        continue;
      }
      productByName.set(name.toLowerCase(), made.id);
    }

    let failed = false;
    const items: ExpenseItemInput[] = original.items.map((it, idx) => {
      const edit = c.items.find((e) => e.position === idx);
      const base: ExpenseItemInput = {
        description: it.description,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        subtotal: it.subtotal,
        discount: it.discount,
        freight_and_other_costs: it.freight_and_other_costs,
        recoverable_tax: it.recoverable_tax,
        non_recoverable_tax: it.non_recoverable_tax,
        purchase_quantity: it.purchase_quantity,
        purchase_unit: it.purchase_unit,
        purchase_unit_cost: it.purchase_unit_cost,
        expiry_date: it.expiry_date,
        for_breakfast: it.for_breakfast,
        cost_item_id: it.cost_item_id,
        new_fixed_asset: null,
        existing_fixed_asset_id: it.fixed_asset_id,
      };
      if (!edit) return base;

      const description = edit.description.trim();
      const quantity = Number(edit.quantity);
      const unitCost = Number(edit.unit_cost);
      if (!description || !(quantity > 0) || !(unitCost >= 0)) {
        errors.push(`Compra de ${original.date}: item "${description || "(sem nome)"}" com descrição, quantidade ou preço inválido.`);
        failed = true;
        return base;
      }

      let costItemId = it.cost_item_id;
      if (!it.fixed_asset_id && description.toLowerCase() !== it.description.trim().toLowerCase()) {
        const found = productByName.get(description.toLowerCase());
        if (!found) {
          errors.push(`Compra de ${original.date}: "${description}" não é um produto cadastrado — escolha um nome da lista.`);
          failed = true;
          return base;
        }
        costItemId = found;
      }

      const valuesChanged = quantity !== it.quantity || unitCost !== it.unit_cost;
      return {
        ...base,
        description,
        cost_item_id: costItemId,
        quantity,
        unit_cost: unitCost,
        // Preço/quantidade corrigidos: o subtotal passa a ser quantidade × preço (sem os ajustes
        // de desconto/frete/tributo do lançamento original) e a unidade de compra digitada some.
        ...(valuesChanged
          ? {
              subtotal: round2(quantity * unitCost),
              discount: 0,
              freight_and_other_costs: 0,
              recoverable_tax: 0,
              non_recoverable_tax: 0,
              purchase_quantity: null,
              purchase_unit: null,
              purchase_unit_cost: null,
            }
          : {}),
      };
    });
    if (failed) continue;

    const fd = new FormData();
    fd.set("date", c.date);
    fd.set("competence_date", c.date);
    fd.set("document_number", c.document_number?.trim() ?? "");
    if (c.supplier_id) fd.set("supplier_id", c.supplier_id);
    if (original.payment_method) fd.set("payment_method", original.payment_method);
    if (original.due_date) fd.set("due_date", original.due_date);
    fd.set("nfce_url", original.nfce_url ?? "");
    fd.set("notes", original.notes ?? "");
    fd.set("total_amount", String(round2(items.reduce((s, i) => s + i.subtotal, 0))));
    fd.set("items", JSON.stringify(items));
    fd.set("confirm_duplicate", "true");

    const result = await updateExpense(c.id, fd);
    if (!result || "error" in result) {
      errors.push((result && "error" in result && result.error) || "Erro ao salvar uma compra.");
      continue;
    }
    saved++;
  }

  return { saved, errors };
}

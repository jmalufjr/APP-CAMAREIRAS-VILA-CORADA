"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import { todayKey } from "@/lib/date";
import { isPurchaseEditable } from "@/lib/purchase-edit-window";
import { ingredientKindForCategory } from "@/lib/expense-model-types";

type Result = { error?: string; success?: boolean; message?: string };

export interface PurchaseEditInput {
  purchaseId: string;
  date: string;
  supplierName: string;
  documentNumber: string;
  paymentMethod: string;
  notes: string;
  lines: { id: string; description: string; categoryId: string | null; ingredientId: string | null; quantity: number; amount: number }[];
}

// Edita uma despesa até 30 dias (janela configurável) depois do fim do mês dela.
// Se a despesa é recorrente, o cadastro do item recorrente acompanha a mudança.
export async function updatePurchase(input: PurchaseEditInput): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  const admin = createAdminClient();
  const today = todayKey();

  const { data: settings } = await admin.from("expense_settings").select("start_date, late_window_days").eq("id", true).single();
  const startDate = settings?.start_date ?? "2026-11-01";
  const windowDays = settings?.late_window_days ?? 30;

  const { data: p } = await admin
    .from("purchases")
    .select("id, date, status, source, supplier_name, purchase_lines(id, description, category_id, ingredient_id, quantity, amount, is_asset)")
    .eq("id", input.purchaseId)
    .maybeSingle();
  if (!p) return { error: "Despesa não encontrada." };
  if (p.status !== "registrada") return { error: "Só despesas registradas podem ser editadas." };
  if (!isPurchaseEditable(p.date, today, windowDays))
    return { error: `Passaram mais de ${windowDays} dias do fim do mês desta despesa: ela não pode mais ser editada.` };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Informe a data da compra." };
  if (input.date > today) return { error: "A data da compra não pode ser futura." };
  if (input.date < startDate) return { error: `O novo modelo começa em ${startDate.split("-").reverse().join("/")}.` };
  if (!isPurchaseEditable(input.date, today, windowDays)) return { error: "A nova data cai num mês já fora do prazo de edição." };

  type DbLine = { id: string; description: string; category_id: string | null; ingredient_id: string | null; quantity: number | string; amount: number | string; is_asset: boolean };
  const dbLines = (p.purchase_lines ?? []) as DbLine[];
  for (const l of input.lines) {
    const old = dbLines.find((x) => x.id === l.id);
    if (!old) return { error: "Item não pertence a esta despesa." };
    if (old.is_asset) return { error: "Itens de ativo permanente não se editam aqui." };
    if (!l.description.trim()) return { error: "Informe a descrição de cada item." };
    if (!l.categoryId) return { error: `Escolha a categoria de "${l.description}".` };
    if (!(l.amount > 0)) return { error: `Informe o valor de "${l.description}".` };
    if (!(l.quantity > 0)) return { error: `Informe a quantidade de "${l.description}".` };
    if (l.ingredientId) {
      const [{ data: cat }, { data: ing }] = await Promise.all([
        admin.from("expense_categories").select("name, rule, allows_ingredient").eq("id", l.categoryId).maybeSingle(),
        admin.from("ingredients").select("kind").eq("id", l.ingredientId).maybeSingle(),
      ]);
      if (!cat || !cat.allows_ingredient) return { error: `A categoria de "${l.description}" não aceita ingrediente.` };
      const need = ingredientKindForCategory(cat);
      if (!ing || (need && ing.kind !== need)) return { error: `O ingrediente de "${l.description}" não combina com a categoria escolhida.` };
    }
  }

  // Item recorrente ligado a esta despesa (pelo nome), identificado ANTES de editar.
  let recurringId: string | null = null;
  let matchedBySupplier = false;
  let matchedLineId: string | null = null;
  if (p.source === "recorrente") {
    const { data: items } = await admin.from("recurring_expenses").select("id, name");
    const oldSupplier = (p.supplier_name ?? "").trim().toLowerCase();
    for (const it of items ?? []) {
      const n = String(it.name).trim().toLowerCase();
      if (oldSupplier && oldSupplier === n) {
        recurringId = it.id;
        matchedBySupplier = true;
        matchedLineId = dbLines.find((l) => !l.is_asset)?.id ?? null;
        break;
      }
      const byLine = dbLines.find((l) => l.description.trim().toLowerCase() === n);
      if (byLine) {
        recurringId = it.id;
        matchedLineId = byLine.id;
        break;
      }
    }
  }

  // Atualiza as linhas editadas.
  for (const l of input.lines) {
    const patch: Record<string, unknown> = {
      description: l.description.trim(),
      category_id: l.categoryId,
      quantity: l.quantity,
      amount: l.amount,
    };
    patch.ingredient_id = l.ingredientId ?? null;
    const { error } = await admin.from("purchase_lines").update(patch).eq("id", l.id);
    if (error) return { error: error.message };
  }

  // Total = soma de todas as linhas da despesa (inclusive as de ativo permanente, intactas).
  const edited = new Map(input.lines.map((l) => [l.id, l.amount]));
  const total = Math.round(dbLines.reduce((s, l) => s + (edited.get(l.id) ?? Number(l.amount)), 0) * 100) / 100;
  const { error: pErr } = await admin
    .from("purchases")
    .update({
      date: input.date,
      supplier_name: input.supplierName.trim() || null,
      document_number: input.documentNumber.trim() || null,
      payment_method: input.paymentMethod || null,
      notes: input.notes.trim() || null,
      total_amount: total,
    })
    .eq("id", p.id);
  if (pErr) return { error: pErr.message };

  // Cadastro do item recorrente acompanha a despesa editada.
  let message = "Despesa atualizada.";
  if (recurringId) {
    const line = input.lines.find((l) => l.id === matchedLineId) ?? input.lines[0];
    const newName = (matchedBySupplier ? input.supplierName.trim() || line.description : line.description).trim();
    const { data: clash } = await admin.from("recurring_expenses").select("id").ilike("name", newName).neq("id", recurringId).limit(1);
    if (clash && clash.length > 0) {
      message = `Despesa atualizada, mas o item recorrente não foi alterado: já existe outro chamado "${newName}".`;
    } else {
      const { error: rErr } = await admin
        .from("recurring_expenses")
        .update({
          name: newName,
          category_id: line.categoryId,
          amount: line.amount,
          day_of_month: Math.min(28, Math.max(1, Number(input.date.slice(8, 10)) || 5)),
        })
        .eq("id", recurringId);
      if (rErr) return { error: `Despesa atualizada, mas não consegui alterar o item recorrente: ${rErr.message}` };
      message = "Despesa e item recorrente atualizados.";
    }
  }

  revalidatePath("/contabil", "layout");
  return { success: true, message };
}

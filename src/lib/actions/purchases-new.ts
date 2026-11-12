"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import { todayKey } from "@/lib/date";
import { ingredientKindForCategory, type CenterCode, type PurchaseRecord } from "@/lib/expense-model-types";
import { describeDestination } from "@/lib/purchase-routing";

type Result = { error?: string; success?: boolean; id?: string };

export interface PurchaseLineInput {
  description: string;
  categoryId: string | null;
  ingredientId: string | null;
  quantity: number;
  amount: number;
  usefulLifeMonths: number | null;
  isAsset: boolean;
  // Também cadastra o item em "Itens recorrentes" (só o admin pode).
  recurring?: boolean;
  // Cadastra um ingrediente novo (tipo da categoria, 0% no Bar, 30 dias) e liga a linha a ele.
  newIngredientName?: string;
}

export interface PurchaseInput {
  date: string;
  supplierName: string;
  documentNumber: string;
  paymentMethod: string;
  notes: string;
  // Se a compra nasceu da caixa de conferência, o id da mensagem de origem
  // (a foto da nota e a marca de "lançada" vêm daí, lidas no servidor).
  inboxId?: string;
  lines: PurchaseLineInput[];
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Cria a compra/despesa no modelo novo. Data da compra = data do pagamento.
// O banco marca sozinho "lançado após o fechamento" (até 30 dias) ou
// "pendente de aprovação" (depois disso) — ver purchases_set_status.
export async function createPurchase(input: PurchaseInput): Promise<Result> {
  const denied = await requireRole(["admin", "gerente_operacional"]);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: settings } = await supabase.from("expense_settings").select("start_date").eq("id", true).single();
  const startDate = settings?.start_date ?? "2026-11-01";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Informe a data da compra." };
  if (input.date > todayKey()) return { error: "A data da compra não pode ser futura." };
  if (input.date < startDate) return { error: `O novo modelo começa em ${startDate.split("-").reverse().join("/")}; não há lançamentos anteriores.` };
  if (input.lines.length === 0) return { error: "Inclua pelo menos um item." };

  for (const [i, l] of input.lines.entries()) {
    const n = i + 1;
    if (!l.description.trim()) return { error: `Item ${n}: informe a descrição.` };
    if (!(l.amount > 0)) return { error: `Item ${n}: informe o valor.` };
    if (!(l.quantity > 0)) return { error: `Item ${n}: informe a quantidade.` };
    if (!l.isAsset && !l.categoryId) return { error: `Item ${n}: escolha a categoria de despesa.` };
  }

  const recurringLines = input.lines.filter((l) => l.recurring && !l.isAsset);
  if (recurringLines.length > 0) {
    const deniedRec = await requireRole(["admin"]);
    if (deniedRec) return { error: "Só o administrador pode marcar uma despesa como recorrente." };
  }

  const total = Math.round(input.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const userId = await currentUserId();

  let receiptPath: string | null = null;
  if (input.inboxId) {
    const { data: inbox } = await supabase
      .from("purchase_inbox")
      .select("image_storage_path, status")
      .eq("id", input.inboxId)
      .maybeSingle();
    if (!inbox) return { error: "Mensagem de origem não encontrada." };
    if (inbox.status !== "aguardando") return { error: "Esta nota já foi lançada ou descartada." };
    receiptPath = inbox.image_storage_path;
  }

  // Ingredientes novos sugeridos (conferidos pela pessoa antes de salvar): resolvidos ANTES de criar a compra.
  const adminClient = createAdminClient();
  const resolvedIngredient: (string | null)[] = [];
  for (const l of input.lines) {
    let ingredientId = l.ingredientId;
    const nm = (l.newIngredientName ?? "").trim();
    if (!ingredientId && nm && !l.isAsset && l.categoryId) {
      const { data: cat } = await adminClient.from("expense_categories").select("name, rule").eq("id", l.categoryId).maybeSingle();
      const kind = cat ? ingredientKindForCategory(cat) : null;
      if (kind) {
        const escaped = nm.replace(/[\\%_]/g, (m) => "\\" + m);
        const { data: existing } = await adminClient.from("ingredients").select("id").ilike("name", escaped).limit(1);
        if (existing && existing.length > 0) ingredientId = existing[0].id;
        else {
          const { data: created, error: iErr } = await adminClient
            .from("ingredients")
            .insert({ name: nm, kind, bar_pct: 0, split_mode: "bar_cafe", consumption_days: 30 })
            .select("id")
            .single();
          if (iErr || !created) return { error: `Não foi possível cadastrar o ingrediente "${nm}": ${iErr?.message ?? ""}` };
          ingredientId = created.id;
        }
      }
    }
    resolvedIngredient.push(ingredientId);
  }

  // Ativo permanente: cria o bem no inventário (editável depois).
  const admin = createAdminClient();
  let assetCategoryId: string | null = null;
  if (input.lines.some((l) => l.isAsset)) {
    const { data: cat } = await admin.from("asset_categories").select("id").order("position").limit(1).maybeSingle();
    if (cat) assetCategoryId = cat.id;
    else {
      const { data: created, error } = await admin.from("asset_categories").insert({ name: "Outros" }).select("id").single();
      if (error) return { error: error.message };
      assetCategoryId = created.id;
    }
  }

  const { data: purchase, error: pErr } = await supabase
    .from("purchases")
    .insert({
      date: input.date,
      supplier_name: input.supplierName.trim() || null,
      document_number: input.documentNumber.trim() || null,
      total_amount: total,
      payment_method: input.paymentMethod || null,
      notes: input.notes.trim() || null,
      source: input.inboxId ? "whatsapp" : "manual",
      receipt_storage_path: receiptPath,
      created_by: userId,
    })
    .select("id")
    .single();
  if (pErr || !purchase) return { error: pErr?.message ?? "Não foi possível salvar a compra." };

  const rows = [];
  for (const [li, l] of input.lines.entries()) {
    let fixedAssetId: string | null = null;
    if (l.isAsset && assetCategoryId) {
      const { data: asset, error: aErr } = await admin
        .from("fixed_assets")
        .insert({
          category_id: assetCategoryId,
          name: l.description.trim(),
          purchase_date: input.date,
          purchase_value: l.amount,
          created_by: userId,
        })
        .select("id")
        .single();
      if (aErr) {
        await supabase.from("purchases").delete().eq("id", purchase.id);
        return { error: aErr.message };
      }
      fixedAssetId = asset.id;
    }
    rows.push({
      purchase_id: purchase.id,
      category_id: l.isAsset ? null : l.categoryId,
      ingredient_id: l.isAsset ? null : resolvedIngredient[li],
      fixed_asset_id: fixedAssetId,
      description: l.description.trim(),
      quantity: l.quantity,
      amount: l.amount,
      is_asset: l.isAsset,
      useful_life_months: l.usefulLifeMonths,
    });
  }

  const { error: lErr } = await supabase.from("purchase_lines").insert(rows);
  if (lErr) {
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return { error: lErr.message };
  }

  if (input.inboxId) {
    await supabase
      .from("purchase_inbox")
      .update({ status: "lancada", purchase_id: purchase.id })
      .eq("id", input.inboxId)
      .eq("status", "aguardando");
  }

  // Itens marcados como recorrentes entram em "Itens recorrentes". O mês desta compra
  // já está lançado pela própria nota, então a geração automática começa no mês seguinte.
  if (recurringLines.length > 0) {
    const { data: existing } = await supabase.from("recurring_expenses").select("name");
    const taken = new Set((existing ?? []).map((e) => String(e.name).trim().toLowerCase()));
    for (const l of recurringLines) {
      const name = (input.lines.length > 1 ? l.description : input.supplierName.trim() || l.description).trim();
      if (!name || taken.has(name.toLowerCase())) continue;
      const { error: rErr } = await supabase.from("recurring_expenses").insert({
        name,
        category_id: l.categoryId,
        amount: l.amount,
        day_of_month: Math.min(28, Math.max(1, Number(input.date.slice(8, 10)) || 5)),
        last_generated_month: `${input.date.slice(0, 7)}-01`,
      });
      if (rErr) return { error: `Compra lançada, mas não consegui cadastrar o item recorrente: ${rErr.message}` };
      taken.add(name.toLowerCase());
    }
  }

  revalidatePath("/contabil", "layout");
  return { success: true, id: purchase.id };
}

// Relatório de despesas: tudo em ordem cronológica da data da compra.
export async function getPurchasesReport(from: string, to: string): Promise<PurchaseRecord[]> {
  const denied = await requireRole(["admin", "gerente_operacional"]);
  if (denied) return [];
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(from) || !isDate(to)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select(
      "id, date, supplier_name, document_number, total_amount, payment_method, notes, source, status, posted_after_close, created_at, purchase_lines(id, description, quantity, amount, is_asset, useful_life_months, category_id, expense_categories(name, rule, expense_category_centers(center_code, pct)), ingredients(name, bar_pct, split_mode))"
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    date: string;
    supplier_name: string | null;
    document_number: string | null;
    total_amount: number | string;
    payment_method: string | null;
    notes: string | null;
    source: PurchaseRecord["source"];
    status: PurchaseRecord["status"];
    posted_after_close: boolean;
    created_at: string;
    purchase_lines: {
      id: string;
      description: string;
      quantity: number | string;
      amount: number | string;
      is_asset: boolean;
      useful_life_months: number | null;
      category_id: string | null;
      expense_categories: CatEmb | CatEmb[] | null;
      ingredients: IngEmb | IngEmb[] | null;
    }[];
  };
  type CatEmb = { name: string; rule: string; expense_category_centers: { center_code: CenterCode; pct: number | string }[] };
  type IngEmb = { name: string; bar_pct: number | string; split_mode: string };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return ((data ?? []) as unknown as Row[]).map((p) => ({
    id: p.id,
    date: p.date,
    supplier_name: p.supplier_name,
    document_number: p.document_number,
    total_amount: Number(p.total_amount),
    payment_method: p.payment_method,
    notes: p.notes,
    source: p.source,
    status: p.status,
    posted_after_close: p.posted_after_close,
    created_at: p.created_at,
    lines: p.purchase_lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity),
      amount: Number(l.amount),
      is_asset: l.is_asset,
      useful_life_months: l.useful_life_months,
      category_id: l.category_id,
      category_name: one(l.expense_categories)?.name ?? null,
      ingredient_name: one(l.ingredients)?.name ?? null,
      destination: l.is_asset
        ? "Ativo permanente"
        : describeDestination({
            rule: one(l.expense_categories)?.rule,
            centers: (one(l.expense_categories)?.expense_category_centers ?? []).map((c) => ({ center_code: c.center_code, pct: Number(c.pct) })),
            ingredient: one(l.ingredients) ? { bar_pct: Number(one(l.ingredients)!.bar_pct), split_mode: one(l.ingredients)!.split_mode } : null,
          }),
    })),
  }));
}

// Só o admin aprova/cancela lançamentos que chegaram depois da janela.
export async function decidePendingPurchase(id: string, decision: "aprovar" | "cancelar"): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchases")
    .update({ status: decision === "aprovar" ? "registrada" : "cancelada" })
    .eq("id", id)
    .eq("status", "pendente_aprovacao");
  if (error) return { error: error.message };
  revalidatePath("/contabil", "layout");
  return { success: true };
}

// Cria, uma vez por mês, o lançamento de cada item recorrente cujo dia já chegou.
export async function generateDueRecurring(): Promise<number> {
  const denied = await requireRole(["admin", "gerente_operacional"]);
  if (denied) return 0;
  const admin = createAdminClient();
  const today = todayKey();
  const monthStart = `${today.slice(0, 7)}-01`;
  const day = Number(today.slice(8, 10));

  const { data: settings } = await admin.from("expense_settings").select("start_date").eq("id", true).single();
  const startDate = settings?.start_date ?? "2026-11-01";

  const { data: items } = await admin
    .from("recurring_expenses")
    .select("id, name, category_id, amount, day_of_month, last_generated_month")
    .eq("active", true);

  let created = 0;
  for (const it of items ?? []) {
    if (it.day_of_month > day) continue;
    if (it.last_generated_month && it.last_generated_month >= monthStart) continue;
    const date = `${today.slice(0, 7)}-${String(it.day_of_month).padStart(2, "0")}`;
    if (date < startDate) continue;

    // Marca primeiro (evita duplicar se duas telas abrirem ao mesmo tempo).
    const { data: claimed } = await admin
      .from("recurring_expenses")
      .update({ last_generated_month: monthStart })
      .eq("id", it.id)
      .or(`last_generated_month.is.null,last_generated_month.lt.${monthStart}`)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: p, error } = await admin
      .from("purchases")
      .insert({ date, supplier_name: it.name, total_amount: it.amount, source: "recorrente" })
      .select("id")
      .single();
    if (error || !p) {
      await admin.from("recurring_expenses").update({ last_generated_month: it.last_generated_month }).eq("id", it.id);
      continue;
    }
    const { error: lErr } = await admin
      .from("purchase_lines")
      .insert({ purchase_id: p.id, category_id: it.category_id, description: it.name, quantity: 1, amount: it.amount });
    if (lErr) {
      await admin.from("purchases").delete().eq("id", p.id);
      await admin.from("recurring_expenses").update({ last_generated_month: it.last_generated_month }).eq("id", it.id);
      continue;
    }
    created++;
  }
  return created;
}

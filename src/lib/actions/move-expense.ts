"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import { todayKey } from "@/lib/date";

type Result = { error?: string; success?: boolean; message?: string };

function refresh() {
  revalidatePath("/contabil", "layout");
  revalidatePath("/ativo-permanente");
}

async function userId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

// Despesa simples -> item recorrente.
// A despesa já foi paga, então continua no relatório (ganha a marca "Recorrente");
// o item recorrente nasce já "gerado" neste mês, e passa a ser lançado sozinho a
// partir do mês seguinte.
export async function moveLineToRecurring(lineId: string): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  const admin = createAdminClient();

  const { data: line } = await admin
    .from("purchase_lines")
    .select("id, description, amount, category_id, is_asset, purchase_id, purchases(date, supplier_name, status)")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { error: "Item não encontrado." };
  const p = one(line.purchases as { date: string; supplier_name: string | null; status: string } | { date: string; supplier_name: string | null; status: string }[] | null);
  if (!p) return { error: "Compra não encontrada." };
  if (p.status === "cancelada") return { error: "Esta compra está cancelada." };
  if (line.is_asset) return { error: "Este item é ativo permanente: mova-o para despesa primeiro." };
  if (!line.category_id) return { error: "O item não tem categoria de despesa." };

  const { count } = await admin.from("purchase_lines").select("id", { count: "exact", head: true }).eq("purchase_id", line.purchase_id);
  const name = ((count ?? 1) > 1 ? line.description : p.supplier_name?.trim() || line.description).trim();

  const { data: existing } = await admin.from("recurring_expenses").select("id").ilike("name", name).limit(1);
  if (existing && existing.length > 0) return { error: `Já existe um item recorrente chamado "${name}".` };

  const { error } = await admin.from("recurring_expenses").insert({
    name,
    category_id: line.category_id,
    amount: Number(line.amount),
    day_of_month: Math.min(28, Math.max(1, Number(p.date.slice(8, 10)) || 5)),
    last_generated_month: `${p.date.slice(0, 7)}-01`,
  });
  if (error) return { error: error.message };

  await admin.from("purchases").update({ source: "recorrente" }).eq("id", line.purchase_id);
  refresh();
  return { success: true, message: "Item recorrente cadastrado. A despesa deste mês continua no relatório." };
}

// Despesa simples -> ativo permanente (cria o bem no inventário).
export async function moveLineToAsset(lineId: string): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  const admin = createAdminClient();

  const { data: line } = await admin
    .from("purchase_lines")
    .select("id, description, amount, is_asset, purchases(date, status)")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { error: "Item não encontrado." };
  const p = one(line.purchases as { date: string; status: string } | { date: string; status: string }[] | null);
  if (!p) return { error: "Compra não encontrada." };
  if (p.status === "cancelada") return { error: "Esta compra está cancelada." };
  if (line.is_asset) return { error: "Este item já é ativo permanente." };

  let categoryId: string | null = null;
  const { data: cat } = await admin.from("asset_categories").select("id").order("position").limit(1).maybeSingle();
  if (cat) categoryId = cat.id;
  else {
    const { data: created, error } = await admin.from("asset_categories").insert({ name: "Outros" }).select("id").single();
    if (error) return { error: error.message };
    categoryId = created.id;
  }

  const { data: asset, error: aErr } = await admin
    .from("fixed_assets")
    .insert({
      category_id: categoryId,
      name: line.description,
      purchase_date: p.date,
      purchase_value: Number(line.amount),
      created_by: await userId(),
    })
    .select("id")
    .single();
  if (aErr || !asset) return { error: aErr?.message ?? "Não foi possível criar o bem." };

  const { error: uErr } = await admin
    .from("purchase_lines")
    .update({ is_asset: true, category_id: null, ingredient_id: null, fixed_asset_id: asset.id })
    .eq("id", lineId);
  if (uErr) {
    await admin.from("fixed_assets").delete().eq("id", asset.id);
    return { error: uErr.message };
  }
  refresh();
  return { success: true, message: "Movido para o ativo permanente." };
}

// Ativo permanente -> despesa. Pode partir do bem (tela de Ativo Permanente) ou da
// linha da compra (Relatório de despesas).
export async function moveAssetToExpense(input: { assetId?: string; lineId?: string; categoryId: string }): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  if (!input.categoryId) return { error: "Escolha a categoria da despesa." };
  const admin = createAdminClient();

  const { data: cat } = await admin.from("expense_categories").select("id").eq("id", input.categoryId).eq("active", true).maybeSingle();
  if (!cat) return { error: "Categoria inválida." };

  let line: { id: string; fixed_asset_id: string | null } | null = null;
  if (input.lineId) {
    const { data } = await admin.from("purchase_lines").select("id, fixed_asset_id, is_asset").eq("id", input.lineId).maybeSingle();
    if (!data || !data.is_asset) return { error: "Item não encontrado ou não é ativo permanente." };
    line = data;
  } else if (input.assetId) {
    const { data } = await admin.from("purchase_lines").select("id, fixed_asset_id").eq("fixed_asset_id", input.assetId).limit(1).maybeSingle();
    line = data;
  } else {
    return { error: "Informe o item." };
  }
  const assetId = input.assetId ?? line?.fixed_asset_id ?? null;

  if (line) {
    const { error } = await admin
      .from("purchase_lines")
      .update({ is_asset: false, category_id: input.categoryId, fixed_asset_id: null })
      .eq("id", line.id);
    if (error) return { error: error.message };
  } else if (assetId) {
    // Bem que não nasceu de uma compra do novo modelo: cria a compra a partir dele.
    const { data: a } = await admin.from("fixed_assets").select("name, purchase_date, purchase_value").eq("id", assetId).maybeSingle();
    if (!a) return { error: "Bem não encontrado." };
    const { data: s } = await admin.from("expense_settings").select("start_date").eq("id", true).single();
    const start = s?.start_date ?? "2026-11-01";
    if (!a.purchase_date || a.purchase_date < start || a.purchase_date > todayKey())
      return { error: `Este bem não tem data de compra a partir de ${start.split("-").reverse().join("/")}; não dá para lançá-lo como despesa.` };
    if (!(Number(a.purchase_value) > 0)) return { error: "Este bem não tem valor de compra." };
    const { data: pur, error: pErr } = await admin
      .from("purchases")
      .insert({ date: a.purchase_date, total_amount: Number(a.purchase_value), source: "manual", created_by: await userId() })
      .select("id")
      .single();
    if (pErr || !pur) return { error: pErr?.message ?? "Não foi possível criar a despesa." };
    const { error: lErr } = await admin
      .from("purchase_lines")
      .insert({ purchase_id: pur.id, category_id: input.categoryId, description: a.name, quantity: 1, amount: Number(a.purchase_value) });
    if (lErr) {
      await admin.from("purchases").delete().eq("id", pur.id);
      return { error: lErr.message };
    }
  } else {
    return { error: "Item não encontrado." };
  }

  if (assetId) await admin.from("fixed_assets").delete().eq("id", assetId);
  refresh();
  return { success: true, message: "Movido para despesa." };
}

// Item recorrente -> despesa. O item deixa de existir; as despesas que ele já
// gerou viram despesas simples. Se neste mês ainda não tinha gerado, cria a
// despesa de hoje para ela não se perder.
export async function moveRecurringToExpense(id: string): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  const admin = createAdminClient();

  const { data: it } = await admin
    .from("recurring_expenses")
    .select("id, name, category_id, amount, last_generated_month")
    .eq("id", id)
    .maybeSingle();
  if (!it) return { error: "Item não encontrado." };

  const today = todayKey();
  const monthStart = `${today.slice(0, 7)}-01`;
  const alreadyThisMonth = !!it.last_generated_month && it.last_generated_month >= monthStart;

  if (!alreadyThisMonth) {
    const { data: pur, error: pErr } = await admin
      .from("purchases")
      .insert({ date: today, supplier_name: it.name, total_amount: Number(it.amount), source: "manual", created_by: await userId() })
      .select("id")
      .single();
    if (pErr || !pur) return { error: pErr?.message ?? "Não foi possível criar a despesa." };
    const { error: lErr } = await admin
      .from("purchase_lines")
      .insert({ purchase_id: pur.id, category_id: it.category_id, description: it.name, quantity: 1, amount: Number(it.amount) });
    if (lErr) {
      await admin.from("purchases").delete().eq("id", pur.id);
      return { error: lErr.message };
    }
  }

  // Despesas já geradas por este item deixam de ter a marca "Recorrente".
  const { data: gen } = await admin.from("purchases").select("id, supplier_name, purchase_lines(description)").eq("source", "recorrente");
  const name = it.name.trim().toLowerCase();
  const ids = (gen ?? [])
    .filter((g) => {
      const lines = (g.purchase_lines ?? []) as { description: string }[];
      return g.supplier_name?.trim().toLowerCase() === name || lines.some((l) => l.description.trim().toLowerCase() === name);
    })
    .map((g) => g.id as string);
  if (ids.length > 0) await admin.from("purchases").update({ source: "manual" }).in("id", ids);

  const { error } = await admin.from("recurring_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { success: true, message: alreadyThisMonth ? "Item recorrente removido; as despesas já lançadas continuam." : "Movido para despesa (lançada hoje)." };
}

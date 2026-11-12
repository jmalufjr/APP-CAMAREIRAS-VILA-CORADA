"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import { EXPENSE_RECEIPTS_BUCKET, signExpenseReceiptUrl } from "@/lib/expense-receipts";
import { readPurchaseWithAI, type AiPurchase } from "@/lib/purchase-ai";
import { createPurchase, type PurchaseLineInput } from "@/lib/actions/purchases-new";
import { isFixedAsset } from "@/lib/expense-allocation";
import { isUnsafeForQuickSave } from "@/lib/purchase-routing";
import { todayKey } from "@/lib/date";

const ROLES = ["admin", "gerente_operacional"] as const;

export interface InboxItem {
  id: string;
  sender: string | null;
  message_date: string;
  note_text: string | null;
  ai_status: "pendente" | "lida" | "erro";
  ai_error: string | null;
  ai_data: AiPurchase | null;
  status: "aguardando" | "lancada" | "descartada";
  image_url: string | null;
  is_pdf: boolean;
}

type ImportResult = { error?: string; status?: "novo" | "repetido"; ai?: "lida" | "erro" | "pendente" };

// Recebe UMA mensagem/nota do arquivo exportado (o navegador envia uma por vez,
// já com a foto comprimida) — lê com a IA e guarda na caixa de conferência.
export async function importInboxEntry(formData: FormData): Promise<ImportResult> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;

  const key = String(formData.get("key") ?? "");
  const sender = String(formData.get("sender") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const text = String(formData.get("text") ?? "");
  const detectRecurring = formData.get("detectRecurring") === "1";
  const file = formData.get("file");
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Mensagem inválida." };

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: existing } = await supabase.from("purchase_inbox").select("id").eq("dedupe_key", key).maybeSingle();
  if (existing) return { status: "repetido" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hasFile = file instanceof File && file.size > 0;
  const { data: row, error: insErr } = await supabase
    .from("purchase_inbox")
    .insert({ dedupe_key: key, sender, message_date: date, message_time: time, note_text: text.trim() || null, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "Não foi possível guardar a mensagem." };

  let path: string | null = null;
  let base64: string | null = null;
  let mediaType = "image/jpeg";
  if (hasFile) {
    mediaType = file.type || "image/jpeg";
    const ext = mediaType === "application/pdf" ? "pdf" : mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
    path = `inbox/${row.id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    base64 = buffer.toString("base64");
    const { error: upErr } = await admin.storage.from(EXPENSE_RECEIPTS_BUCKET).upload(path, buffer, { contentType: mediaType, upsert: true });
    if (upErr) {
      await supabase.from("purchase_inbox").delete().eq("id", row.id);
      return { error: upErr.message };
    }
  }

  const [{ data: cats }, { data: ings }] = await Promise.all([
    supabase.from("expense_categories").select("id, name, rule, allows_ingredient").eq("active", true).order("position"),
    supabase.from("ingredients").select("id, name, kind").eq("active", true).order("name"),
  ]);

  const ai = await readPurchaseWithAI({
    image: base64 ? { base64, mediaType } : null,
    text,
    categories: cats ?? [],
    ingredients: ings ?? [],
    detectRecurring,
  });

  const update =
    "error" in ai
      ? { image_storage_path: path, ai_status: "erro", ai_error: ai.error }
      : { image_storage_path: path, ai_status: "lida", ai_data: ai.data };
  const { error: upd } = await supabase.from("purchase_inbox").update(update).eq("id", row.id);
  if (upd) return { error: upd.message };

  revalidatePath("/contabil/compras", "layout");
  return { status: "novo", ai: "error" in ai ? "erro" : "lida" };
}

async function toItem(r: {
  id: string;
  sender: string | null;
  message_date: string;
  note_text: string | null;
  ai_status: string;
  ai_error: string | null;
  ai_data: unknown;
  status: string;
  image_storage_path: string | null;
}): Promise<InboxItem> {
  return {
    id: r.id,
    sender: r.sender,
    message_date: r.message_date,
    note_text: r.note_text,
    ai_status: r.ai_status as InboxItem["ai_status"],
    ai_error: r.ai_error,
    ai_data: (r.ai_data as AiPurchase | null) ?? null,
    status: r.status as InboxItem["status"],
    image_url: r.image_storage_path ? await signExpenseReceiptUrl(r.image_storage_path) : null,
    is_pdf: !!r.image_storage_path?.endsWith(".pdf"),
  };
}

const COLUMNS = "id, sender, message_date, note_text, ai_status, ai_error, ai_data, status, image_storage_path";

export async function listInbox(): Promise<InboxItem[]> {
  const denied = await requireRole([...ROLES]);
  if (denied) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_inbox")
    .select(COLUMNS)
    .eq("status", "aguardando")
    .order("message_date", { ascending: true })
    .order("created_at", { ascending: true });
  return Promise.all((data ?? []).map(toItem));
}

export async function getInboxItem(id: string): Promise<InboxItem | null> {
  const denied = await requireRole([...ROLES]);
  if (denied) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_inbox").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toItem(data) : null;
}

export async function discardInboxItem(id: string): Promise<{ error?: string; success?: boolean }> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_inbox").update({ status: "descartada" }).eq("id", id).eq("status", "aguardando");
  if (error) return { error: error.message };
  revalidatePath("/contabil/compras", "layout");
  return { success: true };
}


// Lança a nota exatamente como a IA leu, sem abrir o formulário. Se faltar algo
// (categoria, valor...), devolve o motivo e a nota continua na caixa.
export async function quickSaveInboxItem(id: string, recurring: boolean): Promise<{ error?: string; success?: boolean }> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  const item = await getInboxItem(id);
  if (!item || item.status !== "aguardando") return { error: "Esta nota já foi lançada ou descartada." };
  const ai = item.ai_data;
  if (!ai) return { error: "A IA não leu esta nota: abra o item e preencha." };

  const supabase = await createClient();
  const { data: s } = await supabase.from("expense_settings").select("asset_threshold, asset_min_life_months").eq("id", true).single();
  const threshold = Number(s?.asset_threshold ?? 1200);
  const minLife = s?.asset_min_life_months ?? 12;

  let aiLines = ai.lines;
  if (aiLines.length === 0 && ai.total_amount) {
    aiLines = [{ description: ai.supplier_name ?? "Compra", quantity: 1, amount: ai.total_amount, category_id: null, ingredient_id: null, useful_life_months: null }];
  }
  if (aiLines.length === 0) return { error: "A IA não encontrou itens: abra o item e preencha." };

  const { data: catRows } = await supabase.from("expense_categories").select("id, rule");
  const ruleOf = new Map((catRows ?? []).map((c) => [c.id as string, c.rule as string]));
  const unsafe = aiLines.some((l) =>
    isUnsafeForQuickSave({ categoryId: l.category_id, rule: l.category_id ? (ruleOf.get(l.category_id) ?? null) : null, ingredientId: l.ingredient_id })
  );
  if (unsafe) return { error: "O destino do custo desta nota não é certo (falta categoria ou ingrediente). Abra o item para conferir." };

  const lines: PurchaseLineInput[] = aiLines.map((l) => {
    const qty = l.quantity > 0 ? l.quantity : 1;
    const isAsset = isFixedAsset(l.amount / qty, l.useful_life_months, threshold, minLife);
    return {
      description: l.description,
      categoryId: l.category_id,
      ingredientId: l.ingredient_id,
      quantity: qty,
      amount: l.amount,
      usefulLifeMonths: l.useful_life_months,
      isAsset,
      recurring: recurring && !isAsset,
    };
  });
  const date = ai.date && ai.date <= todayKey() ? ai.date : item.message_date;
  const r = await createPurchase({
    date,
    supplierName: ai.supplier_name ?? "",
    documentNumber: ai.document_number ?? "",
    paymentMethod: ai.payment_method ?? "pix",
    notes: item.note_text ?? "",
    lines,
    inboxId: id,
  });
  return r.error ? { error: r.error } : { success: true };
}

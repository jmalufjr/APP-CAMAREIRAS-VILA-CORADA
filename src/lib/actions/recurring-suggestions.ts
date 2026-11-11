"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import type { AiPurchase } from "@/lib/purchase-ai";

export interface RecurringSuggestion {
  key: string;
  name: string;
  categoryId: string | null;
  amount: number;
  dayOfMonth: number;
  lastDate: string;
  months: number; // em quantos meses diferentes apareceu no arquivo
}

type Result = { error?: string; success?: boolean; created?: number; skipped?: number };

// Sugestão ÚNICA de itens recorrentes, feita a partir das notas lidas na primeira
// importação (com a opção "primeira importação" marcada). Só o admin.
export async function getRecurringSuggestions(): Promise<RecurringSuggestion[]> {
  const denied = await requireRole(["admin"]);
  if (denied) return [];
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("purchase_inbox")
    .select("message_date, ai_data")
    .eq("ai_status", "lida")
    .neq("status", "descartada");
  const { data: existing } = await supabase.from("recurring_expenses").select("name");
  const existingNames = new Set((existing ?? []).map((e) => String(e.name).trim().toLowerCase()));

  const groups = new Map<string, { name: string; items: { date: string; ai: AiPurchase }[] }>();
  for (const r of rows ?? []) {
    const ai = r.ai_data as AiPurchase | null;
    if (!ai?.recurring) continue;
    const name = (ai.supplier_name || ai.lines[0]?.description || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const g = groups.get(key) ?? { name, items: [] };
    g.items.push({ date: ai.date ?? r.message_date, ai });
    groups.set(key, g);
  }

  const out: RecurringSuggestion[] = [];
  for (const [key, g] of groups) {
    if (existingNames.has(key)) continue;
    g.items.sort((a, b) => a.date.localeCompare(b.date));
    const last = g.items[g.items.length - 1];
    const amount = last.ai.total_amount ?? last.ai.lines.reduce((s, l) => s + l.amount, 0);
    out.push({
      key,
      name: g.name,
      categoryId: last.ai.lines.find((l) => l.category_id)?.category_id ?? null,
      amount: Math.round(amount * 100) / 100,
      dayOfMonth: Math.min(28, Math.max(1, Number(last.date.slice(8, 10)) || 5)),
      lastDate: last.date,
      months: new Set(g.items.map((i) => i.date.slice(0, 7))).size,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function registerRecurringSuggestions(
  items: { name: string; categoryId: string; amount: number; dayOfMonth: number; lastDate: string }[]
): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  if (items.length === 0) return { error: "Marque pelo menos um item." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("recurring_expenses").select("name");
  const taken = new Set((existing ?? []).map((e) => String(e.name).trim().toLowerCase()));

  let created = 0;
  let skipped = 0;
  for (const it of items) {
    const name = it.name.trim();
    if (!name || !it.categoryId) return { error: `Escolha a categoria de "${name || "item sem nome"}".` };
    if (!(it.amount >= 0)) return { error: `Valor inválido em "${name}".` };
    if (taken.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("recurring_expenses").insert({
      name,
      category_id: it.categoryId,
      amount: it.amount,
      day_of_month: Math.min(28, Math.max(1, Math.floor(it.dayOfMonth) || 5)),
      // O mês da nota já foi (ou será) lançado pela própria nota: evita lançar em duplicidade.
      last_generated_month: /^\d{4}-\d{2}-\d{2}$/.test(it.lastDate) ? `${it.lastDate.slice(0, 7)}-01` : null,
    });
    if (error) return { error: error.message };
    taken.add(name.toLowerCase());
    created++;
  }
  revalidatePath("/contabil", "layout");
  return { success: true, created, skipped };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryCountSession } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/dashboard");
}

export interface CountLineView {
  id: string;
  inventory_item_id: string;
  item_name: string;
  unit: string;
  theoretical_qty: number;
  counted_qty: number | null;
}

// Abre uma nova sessão de contagem física: congela o saldo teórico de
// cada item ativo (de uma categoria, ou de todos) no momento da abertura
// — a variância faz sentido mesmo que outros movimentos aconteçam
// durante a contagem (ver PRD_compras.md seção 5.5).
export async function startCountSession(categoryId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  let itemsQuery = supabase.from("inventory_items").select("id").eq("active", true);
  if (categoryId) itemsQuery = itemsQuery.eq("category_id", categoryId);
  const { data: items } = await itemsQuery;
  if (!items || items.length === 0) return { error: "Nenhum item de estoque encontrado pra essa categoria." };

  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("inventory_item_id, balance")
    .in(
      "inventory_item_id",
      items.map((i) => i.id)
    );
  const balanceMap = new Map((balances ?? []).map((b) => [b.inventory_item_id, Number(b.balance)]));

  const { data: session, error } = await supabase
    .from("inventory_count_sessions")
    .insert({ category_id: categoryId || null, created_by: user.id })
    .select("id")
    .single();
  if (error || !session) return { error: error?.message ?? "Erro ao abrir a contagem." };

  const { error: linesError } = await supabase.from("inventory_count_lines").insert(
    items.map((i) => ({
      session_id: session.id,
      inventory_item_id: i.id,
      theoretical_qty: balanceMap.get(i.id) ?? 0,
    }))
  );
  if (linesError) {
    await supabase.from("inventory_count_sessions").delete().eq("id", session.id);
    return { error: linesError.message };
  }

  revalidateAll();
  return { success: true, sessionId: session.id as string };
}

export async function getOpenCountSessions(): Promise<InventoryCountSession[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_count_sessions")
    .select("*")
    .eq("status", "em_andamento")
    .order("created_at", { ascending: false });
  return (data ?? []) as InventoryCountSession[];
}

export async function getCountSessionLines(sessionId: string): Promise<CountLineView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_count_lines")
    .select("id, inventory_item_id, theoretical_qty, counted_qty, inventory_items(name, unit)")
    .eq("session_id", sessionId);

  type Raw = {
    id: string;
    inventory_item_id: string;
    theoretical_qty: number;
    counted_qty: number | null;
    inventory_items: { name: string; unit: string } | null;
  };

  return ((data ?? []) as unknown as Raw[])
    .map((r) => ({
      id: r.id,
      inventory_item_id: r.inventory_item_id,
      item_name: r.inventory_items?.name ?? "—",
      unit: r.inventory_items?.unit ?? "un",
      theoretical_qty: Number(r.theoretical_qty),
      counted_qty: r.counted_qty === null ? null : Number(r.counted_qty),
    }))
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}

export async function setCountLineValue(lineId: string, countedQty: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_count_lines")
    .update({ counted_qty: countedQty })
    .eq("id", lineId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// Fecha a sessão: grava os ajustes de verdade (via RPC security definer —
// só admin) e marca como concluída.
export async function closeCountSession(sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_inventory_count_session", { p_session_id: sessionId });
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export interface CategoryCountStatus {
  category_id: string;
  category_name: string;
  count_frequency_days: number | null;
  last_closed_at: string | null;
  days_since_last_count: number | null;
  is_due: boolean;
}

// Pra cada categoria de estoque, quando foi a última contagem FECHADA
// (de qualquer sessão, mesmo uma sem categoria — "todos os itens" conta
// pra todas) e se já passou da frequência configurada — base do aviso
// "está na hora de contar de novo" (ver PRD_compras.md). Categoria sem
// `count_frequency_days` nunca aparece como "devida" (sem lembrete
// configurado = sem cobrança nenhuma).
export async function getCategoryCountStatus(): Promise<CategoryCountStatus[]> {
  const supabase = await createClient();
  const [{ data: categories }, { data: sessions }] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, name, count_frequency_days")
      .eq("is_inventory_category", true)
      .eq("active", true),
    supabase
      .from("inventory_count_sessions")
      .select("category_id, closed_at")
      .eq("status", "concluida")
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false }),
  ]);

  // "Todos os itens" (category_id null) conta como contagem recente pra
  // qualquer categoria — se o admin contou tudo de uma vez, nenhuma
  // categoria fica "devida" por causa disso.
  const sessionRows = (sessions ?? []) as { category_id: string | null; closed_at: string }[];
  const globalLastClosedAt = sessionRows.find((s) => s.category_id === null)?.closed_at ?? null;
  const lastClosedByCategory = new Map<string, string>();
  sessionRows.forEach((s) => {
    if (s.category_id && !lastClosedByCategory.has(s.category_id)) lastClosedByCategory.set(s.category_id, s.closed_at);
  });

  const now = Date.now();
  return ((categories ?? []) as { id: string; name: string; count_frequency_days: number | null }[])
    .map((c) => {
      const candidates = [lastClosedByCategory.get(c.id), globalLastClosedAt].filter((v): v is string => !!v);
      const lastClosedAt = candidates.length > 0 ? candidates.sort().reverse()[0] : null;
      const daysSince = lastClosedAt ? Math.floor((now - new Date(lastClosedAt).getTime()) / 86400000) : null;
      const isDue = c.count_frequency_days !== null && (daysSince === null || daysSince >= c.count_frequency_days);
      return {
        category_id: c.id,
        category_name: c.name,
        count_frequency_days: c.count_frequency_days,
        last_closed_at: lastClosedAt,
        days_since_last_count: daysSince,
        is_due: isDue,
      };
    })
    .sort((a, b) => a.category_name.localeCompare(b.category_name));
}

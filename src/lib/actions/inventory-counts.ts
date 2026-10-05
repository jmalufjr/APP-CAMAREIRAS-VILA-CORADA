"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryCountSession, InventoryCountLineHistory } from "@/lib/types";
import { computeTrailingShrinkageAverage, twelveMonthsAgoIso } from "@/lib/inventory-shrinkage";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
}

export interface CountLineView {
  id: string;
  inventory_item_id: string;
  item_name: string;
  unit: string;
  theoretical_qty: number;
  counted_qty: number | null;
  // Contexto de quebra de estoque (ver PRD_compras.md seção 18): os dois
  // últimos vêm do histórico já fechado do item (nunca da sessão atual,
  // que ainda não fechou); os dois primeiros são os limites do item,
  // editáveis aqui mesmo com os steppers de ±1%.
  quebra_maxima_admitida_pct: number;
  indice_relativo_maximo_pct: number;
  quebra_12m_pct: number | null;
  previous_count_date: string | null;
}

// Abre uma nova sessão de contagem física: congela o saldo teórico de
// cada item ativo (de um GRUPO de subcentros com o mesmo nome, ou de
// todos) no momento da abertura — a variância faz sentido mesmo que
// outros movimentos aconteçam durante a contagem (ver PRD_compras.md
// seção 5.5). Desde a Parte 21, o agrupamento é por NOME do subcentro
// (ex.: "Alimentos" junta o subcentro de Café da manhã e o de Bar da
// piscina numa contagem só, mesmo sendo linhas diferentes no Plano de
// Contas) — decisão explícita do proprietário, pra não precisar contar o
// mesmo tipo de material em visitas separadas só porque ele é rateado
// entre centros diferentes.
//
// Antes de criar, confere se já não existe uma sessão "em_andamento" pro
// mesmo grupo (ou pra "todos os itens", quando subcenterGroupName vem
// vazio) — se existir, reaproveita ela em vez de abrir outra (ver
// PRD_compras.md seção 17.8).
export async function startCountSession(subcenterGroupName?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  let existingQuery = supabase
    .from("inventory_count_sessions")
    .select("id")
    .eq("status", "em_andamento");
  existingQuery = subcenterGroupName
    ? existingQuery.eq("subcenter_group_name", subcenterGroupName)
    : existingQuery.is("subcenter_group_name", null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) return { success: true, sessionId: existing.id as string };

  let itemsQuery = supabase.from("inventory_items").select("id").eq("active", true);
  if (subcenterGroupName) {
    const { data: subcenters } = await supabase.from("cost_subcenters").select("id").eq("name", subcenterGroupName);
    const subcenterIds = (subcenters ?? []).map((s) => s.id as string);
    const { data: itemLinks } = subcenterIds.length
      ? await supabase.from("cost_item_subcenters").select("cost_item_id").in("subcenter_id", subcenterIds)
      : { data: [] };
    const costItemIds = [...new Set((itemLinks ?? []).map((l) => l.cost_item_id as string))];
    const { data: costItems } = costItemIds.length
      ? await supabase.from("cost_items").select("inventory_item_id").in("id", costItemIds).eq("is_inventory", true)
      : { data: [] };
    const itemIdsInGroup = [...new Set((costItems ?? []).map((c) => c.inventory_item_id).filter(Boolean) as string[])];
    if (itemIdsInGroup.length === 0) return { error: "Nenhum item de estoque encontrado nesse grupo." };
    itemsQuery = itemsQuery.in("id", itemIdsInGroup);
  }
  const { data: items } = await itemsQuery;
  if (!items || items.length === 0) return { error: "Nenhum item de estoque encontrado nesse grupo." };

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
    .insert({ subcenter_group_name: subcenterGroupName || null, created_by: user.id })
    .select("id")
    .single();
  if (error || !session) {
    // "23505" = a trava do banco (índice único) pegou uma corrida que a
    // checagem acima não viu a tempo — nesse caso a sessão concorrente já
    // existe, só precisa buscar e devolver o id dela em vez de dar erro.
    if (error?.code === "23505") {
      const { data: race } = await existingQuery.maybeSingle();
      if (race) return { success: true, sessionId: race.id as string };
    }
    return { error: error?.message ?? "Erro ao abrir a contagem." };
  }

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

// Histórico (já fechado) de um conjunto de itens, nos últimos 12 meses,
// excluindo a sessão `excludeSessionId` (a que está sendo fechada/aberta
// agora — nunca pode contar como "histórico" de si mesma). Agrupado por
// item, pronto pra alimentar `computeTrailingShrinkageAverage`.
async function fetchItemShrinkageHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemIds: string[],
  excludeSessionId?: string
): Promise<Map<string, { quebra_pct: number; indice_relativo_pct: number | null; closed_at: string }[]>> {
  const byItem = new Map<string, { quebra_pct: number; indice_relativo_pct: number | null; closed_at: string }[]>();
  if (itemIds.length === 0) return byItem;

  let query = supabase
    .from("inventory_count_line_history")
    .select("inventory_item_id, quebra_pct, indice_relativo_pct, closed_at, session_id")
    .in("inventory_item_id", itemIds)
    .gte("closed_at", twelveMonthsAgoIso())
    .not("quebra_pct", "is", null);
  if (excludeSessionId) query = query.neq("session_id", excludeSessionId);
  const { data } = await query;

  ((data ?? []) as { inventory_item_id: string; quebra_pct: number; indice_relativo_pct: number | null; closed_at: string }[]).forEach(
    (row) => {
      const list = byItem.get(row.inventory_item_id) ?? [];
      list.push({ quebra_pct: Number(row.quebra_pct), indice_relativo_pct: row.indice_relativo_pct === null ? null : Number(row.indice_relativo_pct), closed_at: row.closed_at });
      byItem.set(row.inventory_item_id, list);
    }
  );
  return byItem;
}

export async function getCountSessionLines(sessionId: string): Promise<CountLineView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_count_lines")
    .select(
      "id, inventory_item_id, theoretical_qty, counted_qty, inventory_items(name, unit, quebra_maxima_admitida_pct, indice_relativo_maximo_pct)"
    )
    .eq("session_id", sessionId);

  type Raw = {
    id: string;
    inventory_item_id: string;
    theoretical_qty: number;
    counted_qty: number | null;
    inventory_items: { name: string; unit: string; quebra_maxima_admitida_pct: number; indice_relativo_maximo_pct: number } | null;
  };

  const rows = (data ?? []) as unknown as Raw[];
  const itemIds = rows.map((r) => r.inventory_item_id);
  const historyByItem = await fetchItemShrinkageHistory(supabase, itemIds, sessionId);

  return rows
    .map((r) => {
      const history = (historyByItem.get(r.inventory_item_id) ?? []).sort((a, b) => a.closed_at.localeCompare(b.closed_at));
      const maxIndice = Number(r.inventory_items?.indice_relativo_maximo_pct ?? 200);
      return {
        id: r.id,
        inventory_item_id: r.inventory_item_id,
        item_name: r.inventory_items?.name ?? "—",
        unit: r.inventory_items?.unit ?? "un",
        theoretical_qty: Number(r.theoretical_qty),
        counted_qty: r.counted_qty === null ? null : Number(r.counted_qty),
        quebra_maxima_admitida_pct: Number(r.inventory_items?.quebra_maxima_admitida_pct ?? 20),
        indice_relativo_maximo_pct: maxIndice,
        quebra_12m_pct: computeTrailingShrinkageAverage(history, maxIndice),
        previous_count_date: history.length > 0 ? history[history.length - 1].closed_at : null,
      };
    })
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}

// Edição, pelo admin, dos dois limites de quebra de estoque — sempre em
// incrementos de 1%, nunca digitado (mesmo padrão do QuantityStepper já
// usado no resto do projeto).
export async function updateItemQuebraMaximaAdmitida(itemId: string, pct: number) {
  const supabase = await createClient();
  if (pct < 1) return { error: "A quebra máxima admitida precisa ser de pelo menos 1%." };
  const { error } = await supabase.from("inventory_items").update({ quebra_maxima_admitida_pct: pct }).eq("id", itemId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function updateItemIndiceRelativoMaximo(itemId: string, pct: number) {
  const supabase = await createClient();
  if (pct < 1) return { error: "O índice de quebra relativo máximo precisa ser de pelo menos 1%." };
  const { error } = await supabase.from("inventory_items").update({ indice_relativo_maximo_pct: pct }).eq("id", itemId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
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
// só admin) e marca como concluída. Em seguida, calcula e grava, por item
// contado, a "quebra de estoque" dessa contagem — ver PRD_compras.md
// seção 18. Essa segunda etapa é analítica (não afeta o estoque em si,
// que a RPC acima já ajustou com segurança): se ela falhar por qualquer
// motivo, a contagem já está fechada e o estoque já está correto, só os
// dados de quebra dessa sessão ficam ausentes — por isso o erro aqui não
// desfaz o fechamento, só é reportado.
export async function closeCountSession(sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_inventory_count_session", { p_session_id: sessionId });
  if (error) return { error: error.message };

  const shrinkageError = await computeAndStoreShrinkageForSession(supabase, sessionId);

  revalidateAll();
  if (shrinkageError) {
    return { success: true, warning: `Contagem fechada e estoque ajustado, mas houve um erro ao calcular a quebra de estoque: ${shrinkageError}` };
  }
  return { success: true };
}

// Calcula e grava quebra_pct/quebra_12m_pct/indice_relativo_pct pra cada
// linha contada de uma sessão recém-fechada, usando o histórico (de
// OUTRAS sessões já fechadas) de cada item como base da média de 12
// meses. Devolve uma mensagem de erro (ou null se tudo certo).
async function computeAndStoreShrinkageForSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<string | null> {
  const { data: lines, error: linesError } = await supabase
    .from("inventory_count_lines")
    .select("id, inventory_item_id, theoretical_qty, counted_qty")
    .eq("session_id", sessionId)
    .not("counted_qty", "is", null);
  if (linesError) return linesError.message;
  if (!lines || lines.length === 0) return null;

  const itemIds = [...new Set(lines.map((l) => l.inventory_item_id as string))];
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, indice_relativo_maximo_pct")
    .in("id", itemIds);
  if (itemsError) return itemsError.message;
  const maxIndiceByItem = new Map((items ?? []).map((i) => [i.id as string, Number(i.indice_relativo_maximo_pct)]));

  const historyByItem = await fetchItemShrinkageHistory(supabase, itemIds, sessionId);

  const updates = (lines as { id: string; inventory_item_id: string; theoretical_qty: number; counted_qty: number }[]).map((line) => {
    const theoretical = Number(line.theoretical_qty);
    const counted = Number(line.counted_qty);
    const quebra_pct = theoretical !== 0 ? ((counted - theoretical) / theoretical) * 100 : null;

    const maxIndice = maxIndiceByItem.get(line.inventory_item_id) ?? 200;
    const history = historyByItem.get(line.inventory_item_id) ?? [];
    const quebra_12m_pct = computeTrailingShrinkageAverage(history, maxIndice);

    const indice_relativo_pct =
      quebra_pct !== null && quebra_12m_pct !== null && quebra_12m_pct !== 0
        ? Math.abs((quebra_pct / quebra_12m_pct) * 100)
        : null;

    return { id: line.id, quebra_pct, quebra_12m_pct, indice_relativo_pct };
  });

  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("inventory_count_lines")
        .update({ quebra_pct: u.quebra_pct, quebra_12m_pct: u.quebra_12m_pct, indice_relativo_pct: u.indice_relativo_pct })
        .eq("id", u.id)
    )
  );
  const firstError = results.find((r) => r.error);
  return firstError?.error?.message ?? null;
}

// Histórico de contagens fechadas num período — base do card "Histórico
// de contagem de estoque" na tela Histórico do admin.
export async function getInventoryCountHistoryForPeriod(from: string, to: string): Promise<InventoryCountLineHistory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_count_line_history")
    .select("*")
    .gte("closed_at", `${from}T00:00:00`)
    .lte("closed_at", `${to}T23:59:59`)
    .order("closed_at", { ascending: false });
  return ((data ?? []) as InventoryCountLineHistory[]).map((r) => ({
    ...r,
    theoretical_qty: Number(r.theoretical_qty),
    counted_qty: Number(r.counted_qty),
    diferenca: Number(r.diferenca),
    quebra_pct: r.quebra_pct === null ? null : Number(r.quebra_pct),
    quebra_12m_pct: r.quebra_12m_pct === null ? null : Number(r.quebra_12m_pct),
    indice_relativo_pct: r.indice_relativo_pct === null ? null : Number(r.indice_relativo_pct),
    quebra_maxima_admitida_pct: Number(r.quebra_maxima_admitida_pct),
    indice_relativo_maximo_pct: Number(r.indice_relativo_maximo_pct),
  }));
}

// Itens cuja ÚLTIMA contagem fechada ficou com quebra de estoque (em
// módulo, pra pegar tanto falta quanto sobra fora do padrão) acima da
// quebra máxima admitida daquele item — base da tela "Quebra de Estoque"
// do Resumo Executivo. Ordenado do desvio mais grave pro menos grave.
export async function getItemsAboveShrinkageThreshold(): Promise<InventoryCountLineHistory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_count_line_history")
    .select("*")
    .not("quebra_pct", "is", null)
    .order("closed_at", { ascending: false });

  const rows = (data ?? []) as InventoryCountLineHistory[];
  const latestByItem = new Map<string, InventoryCountLineHistory>();
  rows.forEach((r) => {
    if (!latestByItem.has(r.inventory_item_id)) latestByItem.set(r.inventory_item_id, r);
  });

  return [...latestByItem.values()]
    .filter((r) => Math.abs(Number(r.quebra_pct)) > Number(r.quebra_maxima_admitida_pct))
    .map((r) => ({
      ...r,
      theoretical_qty: Number(r.theoretical_qty),
      counted_qty: Number(r.counted_qty),
      diferenca: Number(r.diferenca),
      quebra_pct: Number(r.quebra_pct),
      quebra_12m_pct: r.quebra_12m_pct === null ? null : Number(r.quebra_12m_pct),
      indice_relativo_pct: r.indice_relativo_pct === null ? null : Number(r.indice_relativo_pct),
      quebra_maxima_admitida_pct: Number(r.quebra_maxima_admitida_pct),
      indice_relativo_maximo_pct: Number(r.indice_relativo_maximo_pct),
    }))
    .sort((a, b) => Math.abs(Number(b.quebra_pct)) - Math.abs(Number(a.quebra_pct)));
}

export interface SubcenterGroupCountStatus {
  group_name: string;
  count_frequency_days: number | null;
  last_closed_at: string | null;
  days_since_last_count: number | null;
  is_due: boolean;
}

// Pra cada GRUPO de subcentros com o mesmo nome (ex.: "Alimentos" junta o
// subcentro de Café da manhã e o de Bar da piscina — ver startCountSession
// pro porquê), quando foi a última contagem FECHADA (de qualquer sessão,
// mesmo uma sem grupo — "todos os itens" conta pra todos) e se já passou
// da frequência configurada — base do aviso "está na hora de contar de
// novo". Só aparecem grupos com pelo menos 1 item de estoque de verdade
// ligado (sem isso, não haveria nada pra contar). Grupo sem
// `count_frequency_days` em nenhum dos seus subcentros nunca aparece
// como "devido" (sem lembrete configurado = sem cobrança nenhuma).
export async function getSubcenterGroupCountStatus(): Promise<SubcenterGroupCountStatus[]> {
  const supabase = await createClient();
  const [{ data: subcenters }, { data: itemLinks }, { data: costItems }, { data: sessions }] = await Promise.all([
    supabase.from("cost_subcenters").select("id, name, count_frequency_days").eq("active", true),
    supabase.from("cost_item_subcenters").select("cost_item_id, subcenter_id"),
    supabase.from("cost_items").select("id, is_inventory"),
    supabase
      .from("inventory_count_sessions")
      .select("subcenter_group_name, closed_at")
      .eq("status", "concluida")
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false }),
  ]);

  const inventoryCostItemIds = new Set(
    ((costItems ?? []) as { id: string; is_inventory: boolean }[]).filter((c) => c.is_inventory).map((c) => c.id)
  );
  const subcentersWithStock = new Set(
    ((itemLinks ?? []) as { cost_item_id: string; subcenter_id: string }[])
      .filter((l) => inventoryCostItemIds.has(l.cost_item_id))
      .map((l) => l.subcenter_id)
  );

  // "Todos os itens" (subcenter_group_name null) conta como contagem
  // recente pra qualquer grupo — se o admin contou tudo de uma vez,
  // nenhum grupo fica "devido" por causa disso.
  const sessionRows = (sessions ?? []) as { subcenter_group_name: string | null; closed_at: string }[];
  const globalLastClosedAt = sessionRows.find((s) => s.subcenter_group_name === null)?.closed_at ?? null;
  const lastClosedByGroup = new Map<string, string>();
  sessionRows.forEach((s) => {
    if (s.subcenter_group_name && !lastClosedByGroup.has(s.subcenter_group_name)) lastClosedByGroup.set(s.subcenter_group_name, s.closed_at);
  });

  const byGroupName = new Map<string, { frequency: number | null; hasStock: boolean }>();
  ((subcenters ?? []) as { id: string; name: string; count_frequency_days: number | null }[]).forEach((s) => {
    const entry = byGroupName.get(s.name) ?? { frequency: null, hasStock: false };
    if (subcentersWithStock.has(s.id)) entry.hasStock = true;
    if (s.count_frequency_days !== null && (entry.frequency === null || s.count_frequency_days < entry.frequency)) {
      entry.frequency = s.count_frequency_days;
    }
    byGroupName.set(s.name, entry);
  });

  const now = Date.now();
  return Array.from(byGroupName.entries())
    .filter(([, v]) => v.hasStock)
    .map(([name, v]) => {
      const candidates = [lastClosedByGroup.get(name), globalLastClosedAt].filter((x): x is string => !!x);
      const lastClosedAt = candidates.length > 0 ? candidates.sort().reverse()[0] : null;
      const daysSince = lastClosedAt ? Math.floor((now - new Date(lastClosedAt).getTime()) / 86400000) : null;
      const isDue = v.frequency !== null && (daysSince === null || daysSince >= v.frequency);
      return {
        group_name: name,
        count_frequency_days: v.frequency,
        last_closed_at: lastClosedAt,
        days_since_last_count: daysSince,
        is_due: isDue,
      };
    })
    .sort((a, b) => a.group_name.localeCompare(b.group_name));
}

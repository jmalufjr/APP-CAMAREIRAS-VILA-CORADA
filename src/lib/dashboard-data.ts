import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/date";
import { getAvailableSuites } from "@/lib/available-suites";
import { getRoomBillsOverview } from "@/lib/actions/room-bills";
import { getMonthlyResult } from "@/lib/actions/monthly-result";
import { getIndicators } from "@/lib/actions/indicators";
import { getGuestReviews } from "@/lib/actions/stays-reviews";

export interface RankedItem {
  name: string;
  quantity: number;
}

export interface OperationalDashboard {
  today: string;
  services: { total: number; done: number; inProgress: number; pending: number; review: number; cancelled: number };
  pendingReview: number;
  occurrences: { today: number; open: number };
  arrivals: number;
  departures: number;
  breakfast: { tables: number; guests: number };
  suites: { clean: string[]; dirty: string[] };
  accounts: { open: number; total: number };
  top: { frigobar: RankedItem[]; petiscos: RankedItem[]; drinks: RankedItem[]; bebidas: RankedItem[] };
}

// Busca todas as linhas de uma consulta, página a página (o limite padrão do banco é 1000 linhas).
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return rows;
}

function top5(map: Map<string, number>): RankedItem[] {
  return Array.from(map.entries())
    .filter(([, q]) => q > 0)
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, 5);
}

// Consumo desde o início, só por quantidade: frigobar (todas as contas) e bar da piscina por categoria
// (comandas não canceladas).
async function getTopConsumption(): Promise<OperationalDashboard["top"]> {
  const supabase = await createClient();

  type MiniRow = { quantity: number; minibar_items: { name: string } | null };
  const mini = await fetchAll<MiniRow>((from, to) =>
    supabase.from("room_bill_minibar_items").select("quantity, minibar_items(name)").order("bill_id").order("minibar_item_id").range(from, to)
  );
  const frigobar = new Map<string, number>();
  mini.forEach((r) => {
    const n = r.minibar_items?.name ?? "—";
    frigobar.set(n, (frigobar.get(n) ?? 0) + r.quantity);
  });

  type BarRow = { quantity: number; poolbar_items: { name: string; category: string | null } | null; bar_comandas: { status: string } | null };
  const bar = await fetchAll<BarRow>((from, to) =>
    supabase
      .from("bar_comanda_items")
      .select("quantity, poolbar_items(name, category), bar_comandas!inner(status)")
      .neq("bar_comandas.status", "cancelada")
      .order("id")
      .range(from, to)
  );
  const petiscos = new Map<string, number>();
  const drinks = new Map<string, number>();
  const bebidas = new Map<string, number>();
  bar.forEach((r) => {
    const item = r.poolbar_items;
    if (!item) return;
    const target = item.category === "Petiscos" ? petiscos : item.category === "Drinks" ? drinks : bebidas;
    target.set(item.name, (target.get(item.name) ?? 0) + r.quantity);
  });

  return { frigobar: top5(frigobar), petiscos: top5(petiscos), drinks: top5(drinks), bebidas: top5(bebidas) };
}

export async function getOperationalDashboard(): Promise<OperationalDashboard> {
  const supabase = await createClient();
  const today = todayKey();

  const [
    { data: tasks },
    { count: pendingReview },
    { count: occToday },
    { count: occOpen },
    { count: arrivals },
    { count: departures },
    { data: assignments },
    suites,
    bills,
    top,
  ] = await Promise.all([
    supabase.from("daily_room_tasks").select("status").eq("date", today),
    supabase.from("daily_room_tasks").select("id", { count: "exact", head: true }).in("status", ["aguardando_revisao", "em_revisao", "aguardando_correcao", "em_correcao"]),
    supabase
      .from("daily_room_task_occurrences")
      .select("id, daily_room_tasks!inner(date)", { count: "exact", head: true })
      .eq("daily_room_tasks.date", today),
    supabase.from("daily_room_task_occurrences").select("id", { count: "exact", head: true }).in("status", ["pendente", "selecionada"]),
    supabase.from("daily_arrivals").select("id", { count: "exact", head: true }).eq("date", today),
    supabase.from("daily_departures").select("id", { count: "exact", head: true }).eq("date", today),
    supabase.from("daily_breakfast_room_assignments").select("table_id, guest_count").eq("date", today),
    getAvailableSuites(supabase),
    getRoomBillsOverview(),
    getTopConsumption(),
  ]);

  const statuses = (tasks ?? []).map((t) => t.status as string);
  const count = (...s: string[]) => statuses.filter((x) => s.includes(x)).length;
  const asg = (assignments ?? []) as { table_id: string; guest_count: number }[];

  return {
    today,
    services: {
      total: statuses.filter((s) => s !== "cancelado").length,
      done: count("concluido"),
      inProgress: count("em_andamento"),
      pending: count("pendente"),
      review: count("aguardando_revisao", "em_revisao", "aguardando_correcao", "em_correcao"),
      cancelled: count("cancelado"),
    },
    pendingReview: pendingReview ?? 0,
    occurrences: { today: occToday ?? 0, open: occOpen ?? 0 },
    arrivals: arrivals ?? 0,
    departures: departures ?? 0,
    breakfast: { tables: new Set(asg.map((a) => a.table_id)).size, guests: asg.reduce((s, a) => s + a.guest_count, 0) },
    suites: { clean: suites.limpas, dirty: suites.sujas },
    accounts: { open: bills.length, total: bills.reduce((s, b) => s + b.grandTotal, 0) },
    top,
  };
}

export interface GerencialDashboard {
  month: string;
  result: { revenue: number; expenses: number; operating: number; lodgingNet: number; bar: number; frigobar: number } | null;
  centers: { center: string; revenue: number; expenses: number }[];
  topExpenses: { name: string; amount: number }[];
  indicators: {
    current: { adr: number | null; revpar: number | null; occ: number | null; paid: number; revenue: number } | null;
    series: { month: string; revenue: number; occ: number | null }[];
  } | null;
  reviews: { average: number | null; total: number; last90: number | null; news: number } | null;
}

export async function getGerencialDashboard(): Promise<GerencialDashboard> {
  const month = todayKey().slice(0, 7);
  const [result, indicators, reviews] = await Promise.all([getMonthlyResult(month), getIndicators(), getGuestReviews()]);

  let resultOut: GerencialDashboard["result"] = null;
  let centers: GerencialDashboard["centers"] = [];
  let topExpenses: GerencialDashboard["topExpenses"] = [];
  if (!("error" in result)) {
    resultOut = {
      revenue: result.totalRevenue,
      expenses: result.totalExpenses,
      operating: result.operatingResult,
      lodgingNet: result.lodging.net,
      bar: result.bar.total,
      frigobar: result.frigobar.total,
    };
    centers = result.byCenter.map((c) => ({ center: c.center, revenue: c.revenue, expenses: c.expenses }));
    const byCategory = new Map<string, number>();
    result.byCenter.forEach((c) => c.categories.forEach((l) => byCategory.set(l.name, (byCategory.get(l.name) ?? 0) + l.amount)));
    topExpenses = Array.from(byCategory.entries())
      .map(([name, amount]) => ({ name, amount }))
      .filter((l) => l.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  let indOut: GerencialDashboard["indicators"] = null;
  if (!("error" in indicators)) {
    const cur = indicators.open[0] ?? null;
    const lastClosed = indicators.closed.slice(0, 5).reverse();
    const series = [...lastClosed, ...(cur ? [cur] : [])].map((m) => ({ month: m.month.slice(0, 7), revenue: m.revenue, occ: m.occCommercial }));
    indOut = {
      current: cur ? { adr: cur.adr, revpar: cur.revpar, occ: cur.occCommercial, paid: cur.paid, revenue: cur.revenue } : null,
      series,
    };
  }

  let revOut: GerencialDashboard["reviews"] = null;
  if (!("error" in reviews)) {
    const rated = reviews.reviews.filter((r) => r.rating !== null && r.rating > 0);
    const avg = (list: typeof rated) => (list.length ? list.reduce((s, r) => s + (r.rating as number), 0) / list.length : null);
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    revOut = {
      average: avg(rated),
      total: rated.length,
      last90: avg(rated.filter((r) => r.day >= cutoff)),
      news: reviews.reviews.filter((r) => r.isNew).length,
    };
  }

  return { month, result: resultOut, centers, topExpenses, indicators: indOut, reviews: revOut };
}

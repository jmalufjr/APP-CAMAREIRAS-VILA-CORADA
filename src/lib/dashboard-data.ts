import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/date";
import { getAvailableSuites } from "@/lib/available-suites";
import { getRoomBillsOverview } from "@/lib/actions/room-bills";
import { getMonthlyResult } from "@/lib/actions/monthly-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadIndicators } from "@/lib/indicators-load";
import { channelAverage, type ItemAverage } from "@/lib/stays/reviews";
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

export interface CenterRow {
  center: string;
  revenue: number;
  expenses: number;
}

export interface ChartPoint {
  month: string; // AAAA-MM
  revenue: number | null;
  profit: number | null;
  adr: number | null;
  revpar: number | null;
  occ: number | null;
  isCurrent: boolean;
}

export interface GerencialDashboard {
  month: string;
  // Primeiro mês do acumulado/média (nunca antes de nov/2026) e quantos meses entram na conta.
  windowStart: string;
  windowMonths: number;
  result: { revenue: number; expenses: number; operating: number; lodgingNet: number; bar: number; frigobar: number } | null;
  centersCurrent: CenterRow[];
  centersAccum: CenterRow[];
  expenseRanking: { name: string; current: number; average: number }[];
  series: ChartPoint[];
  indicators: { current: { adr: number | null; revpar: number | null; occ: number | null; paid: number; revenue: number } | null } | null;
  reviews: {
    average: number | null;
    total: number;
    last90: number | null;
    news: number;
    booking: { average: number | null; count: number; items: ItemAverage[] } | null;
  } | null;
}

// Início do controle gerencial (modelo simplificado): nada antes disso entra nas somas e médias.
const MODEL_START = "2026-11";

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

// Hospedagem e café da manhã aparecem juntos.
function mergeCenters(rows: CenterRow[]): CenterRow[] {
  const out: CenterRow[] = [];
  rows.forEach((c) => {
    const key = c.center === "cafe" ? "hospedagem" : c.center;
    const found = out.find((o) => o.center === key);
    if (found) {
      found.revenue += c.revenue;
      found.expenses += c.expenses;
    } else out.push({ center: key, revenue: c.revenue, expenses: c.expenses });
  });
  return out;
}

// O acesso (administrador ou gerente operacional) já foi conferido pela página; as leituras usam o
// cliente do sistema porque os indicadores da Stays só o administrador lê pelas regras do banco.
export async function getGerencialDashboard(): Promise<GerencialDashboard> {
  const month = todayKey().slice(0, 7);
  const lastTwelve = shiftMonth(month, -11);
  const windowStart = lastTwelve > MODEL_START ? lastTwelve : MODEL_START;
  const windowList: string[] = [];
  for (let m = windowStart; m <= month; m = shiftMonth(m, 1)) windowList.push(m);

  const [results, indicators, reviews] = await Promise.all([
    Promise.all(windowList.map((m) => getMonthlyResult(m))),
    loadIndicators(createAdminClient()),
    getGuestReviews(),
  ]);

  type Ok = Exclude<(typeof results)[number], { error: string }>;
  const okResults = new Map<string, Ok>();
  results.forEach((r, i) => {
    if (!("error" in r)) okResults.set(windowList[i], r);
  });

  const cur = okResults.get(month) ?? null;
  const resultOut: GerencialDashboard["result"] = cur
    ? {
        revenue: cur.totalRevenue,
        expenses: cur.totalExpenses,
        operating: cur.operatingResult,
        lodgingNet: cur.lodging.net,
        bar: cur.bar.total,
        frigobar: cur.frigobar.total,
      }
    : null;

  const centersCurrent = cur ? mergeCenters(cur.byCenter.map((c) => ({ center: c.center, revenue: c.revenue, expenses: c.expenses }))) : [];
  const accum = new Map<string, CenterRow>();
  const catCurrent = new Map<string, number>();
  const catTotal = new Map<string, number>();
  okResults.forEach((r, m) => {
    r.byCenter.forEach((c) => {
      const a = accum.get(c.center) ?? { center: c.center, revenue: 0, expenses: 0 };
      a.revenue += c.revenue;
      a.expenses += c.expenses;
      accum.set(c.center, a);
      c.categories.forEach((l) => {
        catTotal.set(l.name, (catTotal.get(l.name) ?? 0) + l.amount);
        if (m === month) catCurrent.set(l.name, (catCurrent.get(l.name) ?? 0) + l.amount);
      });
    });
  });
  const centersAccum = mergeCenters(Array.from(accum.values()));

  const monthsCount = Math.max(1, okResults.size);
  const expenseRanking = Array.from(new Set([...catCurrent.keys(), ...catTotal.keys()]))
    .map((name) => ({ name, current: catCurrent.get(name) ?? 0, average: (catTotal.get(name) ?? 0) / monthsCount }))
    .filter((e) => e.current > 0 || e.average > 0)
    .sort((a, b) => Math.max(b.current, b.average) - Math.max(a.current, a.average))
    .slice(0, 6);

  // Gráfico: 12 meses para trás, o mês corrente e 5 para frente.
  const byMonth = new Map<string, { adr: number | null; revpar: number | null; occ: number | null; revenue: number }>();
  let indOut: GerencialDashboard["indicators"] = null;
  if (!("error" in indicators)) {
    [...indicators.closed, ...indicators.open].forEach((m) =>
      byMonth.set(m.month.slice(0, 7), { adr: m.adr, revpar: m.revpar, occ: m.occCommercial, revenue: m.revenue })
    );
    const c = indicators.open[0] ?? null;
    indOut = { current: c ? { adr: c.adr, revpar: c.revpar, occ: c.occCommercial, paid: c.paid, revenue: c.revenue } : null };
  }
  const series: ChartPoint[] = [];
  for (let i = -12; i <= 5; i++) {
    const m = shiftMonth(month, i);
    const ind = byMonth.get(m);
    series.push({
      month: m,
      revenue: ind ? ind.revenue : null,
      profit: okResults.get(m)?.operatingResult ?? null,
      adr: ind?.adr ?? null,
      revpar: ind?.revpar ?? null,
      occ: ind?.occ ?? null,
      isCurrent: m === month,
    });
  }

  let revOut: GerencialDashboard["reviews"] = null;
  if (!("error" in reviews)) {
    const rated = reviews.reviews.filter((r) => r.rating !== null && r.rating > 0);
    const avg = (list: typeof rated) => (list.length ? list.reduce((s, r) => s + (r.rating as number), 0) / list.length : null);
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const b = channelAverage(reviews.reviews, "bookingcom");
    // Notas em escala de 0 a 10 (as da Stays vêm de 0 a 5).
    const x2 = (v: number | null) => (v === null ? null : v * 2);
    revOut = {
      average: x2(avg(rated)),
      total: rated.length,
      last90: x2(avg(rated.filter((r) => r.day >= cutoff))),
      news: reviews.reviews.filter((r) => r.isNew).length,
      booking: b.count > 0 ? { average: x2(b.average), count: b.count, items: b.items.map((i) => ({ ...i, average: i.average * 2 })) } : null,
    };
  }

  return {
    month,
    windowStart,
    windowMonths: monthsCount,
    result: resultOut,
    centersCurrent,
    centersAccum,
    expenseRanking,
    series,
    indicators: indOut,
    reviews: revOut,
  };
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayKey, tomorrowKey, startOfDayBrasiliaUtc, dateKeyInBrazil, formatTimePt } from "@/lib/date";
import { getAvailableSuites } from "@/lib/available-suites";
import { getRoomBillsOverview } from "@/lib/actions/room-bills";
import { getMonthlyResult } from "@/lib/actions/monthly-result";
import { getGuestReviews } from "@/lib/actions/stays-reviews";
import { loadIndicators } from "@/lib/indicators-load";
import { channelAverage, type ItemAverage } from "@/lib/stays/reviews";
import { taskTypeLabel } from "@/lib/task-type";
import { taskStatusLabel, type ChecklistType, type DailyRoomTask } from "@/lib/types";

export interface RankedItem {
  name: string;
  quantity: number;
}

// Item mais consumido no mês corrente, com a quantidade do mês anterior ao lado.
export interface MonthlyRankedItem {
  name: string;
  current: number;
  previous: number;
}

export interface ConsumptionBlock {
  monthly: MonthlyRankedItem[];
  // Os 5 itens mais consumidos desde o início (a tela calcula a fatia de cada um entre os cinco).
  pie: RankedItem[];
}

export interface OperationalDashboard {
  today: string;
  todaySuites: { id: string; room: string; label: string; status: string; done: boolean }[];
  occurrences: { today: number; open: number };
  arrivals: { id: string; room: string; firstName: string; time: string | null }[];
  departures: { id: string; room: string; firstName: string }[];
  breakfast: { today: { tables: number; guests: number }; tomorrow: { tables: number; guests: number } };
  suites: { clean: string[]; dirty: string[] };
  accounts: {
    open: number;
    total: number;
    // Hóspedes que já saíram: conta ainda aberta/reaberta e conta já fechada (aguardando pagamento).
    checkoutOpen: { count: number; total: number };
    checkoutClosed: { count: number; total: number };
  };
  top: { frigobar: ConsumptionBlock; petiscos: ConsumptionBlock; drinks: ConsumptionBlock; bebidas: ConsumptionBlock };
  monthLabels: { current: string; previous: string };
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

function topN(map: Map<string, number>, n = 5): RankedItem[] {
  return Array.from(map.entries())
    .filter(([, q]) => q > 0)
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, n);
}

function add(map: Map<string, number>, name: string, qty: number) {
  map.set(name, (map.get(name) ?? 0) + qty);
}

// Os 5 mais consumidos do mês corrente (com o mês anterior ao lado) e, à parte, os 5 maiores desde o início.
function buildBlock(allTime: Map<string, number>, cur: Map<string, number>, prev: Map<string, number>): ConsumptionBlock {
  return {
    monthly: topN(cur).map((i) => ({ name: i.name, current: i.quantity, previous: prev.get(i.name) ?? 0 })),
    pie: topN(allTime),
  };
}

// Consumo: frigobar (desde o início pelo total de cada conta; por mês pelo registro de lançamentos) e bar da
// piscina por categoria (comandas não canceladas, pelo dia em que a comanda foi lançada).
async function getTopConsumption(month: string, prevMonth: string): Promise<OperationalDashboard["top"]> {
  const supabase = await createClient();
  const nextMonth = shiftMonth(month, 1);
  const fromIso = startOfDayBrasiliaUtc(`${prevMonth}-01`);
  const toIso = startOfDayBrasiliaUtc(`${nextMonth}-01`);

  type MiniRow = { quantity: number; minibar_items: { name: string } | null };
  const mini = await fetchAll<MiniRow>((from, to) =>
    supabase.from("room_bill_minibar_items").select("quantity, minibar_items(name)").order("bill_id").order("minibar_item_id").range(from, to)
  );
  const frigAll = new Map<string, number>();
  mini.forEach((r) => add(frigAll, r.minibar_items?.name ?? "—", r.quantity));

  type LaunchRow = { delta: number; launched_on: string; minibar_items: { name: string } | null };
  const launches = await fetchAll<LaunchRow>((from, to) =>
    supabase
      .from("minibar_launches")
      .select("delta, launched_on, minibar_items(name)")
      .gte("launched_on", `${prevMonth}-01`)
      .lt("launched_on", `${nextMonth}-01`)
      .order("id")
      .range(from, to)
  );
  const frigCur = new Map<string, number>();
  const frigPrev = new Map<string, number>();
  launches.forEach((r) => add(r.launched_on.slice(0, 7) === month ? frigCur : frigPrev, r.minibar_items?.name ?? "—", r.delta));

  type BarRow = {
    quantity: number;
    poolbar_items: { name: string; category: string | null } | null;
    bar_comandas: { status: string; created_at: string };
  };
  const bar = await fetchAll<BarRow>((from, to) =>
    supabase
      .from("bar_comanda_items")
      .select("quantity, poolbar_items(name, category), bar_comandas!inner(status, created_at)")
      .neq("bar_comandas.status", "cancelada")
      .order("id")
      .range(from, to)
  );
  const cats = {
    petiscos: { all: new Map<string, number>(), cur: new Map<string, number>(), prev: new Map<string, number>() },
    drinks: { all: new Map<string, number>(), cur: new Map<string, number>(), prev: new Map<string, number>() },
    bebidas: { all: new Map<string, number>(), cur: new Map<string, number>(), prev: new Map<string, number>() },
  };
  bar.forEach((r) => {
    const item = r.poolbar_items;
    if (!item) return;
    const c = item.category === "Petiscos" ? cats.petiscos : item.category === "Drinks" ? cats.drinks : cats.bebidas;
    add(c.all, item.name, r.quantity);
    const created = r.bar_comandas.created_at;
    if (created >= fromIso && created < toIso) {
      const m = dateKeyInBrazil(created).slice(0, 7);
      if (m === month) add(c.cur, item.name, r.quantity);
      else if (m === prevMonth) add(c.prev, item.name, r.quantity);
    }
  });

  return {
    frigobar: buildBlock(frigAll, frigCur, frigPrev),
    petiscos: buildBlock(cats.petiscos.all, cats.petiscos.cur, cats.petiscos.prev),
    drinks: buildBlock(cats.drinks.all, cats.drinks.cur, cats.drinks.prev),
    bebidas: buildBlock(cats.bebidas.all, cats.bebidas.cur, cats.bebidas.prev),
  };
}

const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "—";
const roomNum = (n: string) => Number(n) || 0;

export async function getOperationalDashboard(): Promise<OperationalDashboard> {
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const month = today.slice(0, 7);
  const prevMonth = shiftMonth(month, -1);

  const [
    { data: tasks },
    { count: occToday },
    { count: occOpen },
    { data: arrivalRows },
    { data: departureRows },
    { data: assignments },
    suites,
    bills,
    top,
  ] = await Promise.all([
    supabase.from("daily_room_tasks").select("*, rooms(number), chooser:profiles!daily_room_tasks_assigned_to_fkey(name)").eq("date", today),
    supabase
      .from("daily_room_task_occurrences")
      .select("id, daily_room_tasks!inner(date)", { count: "exact", head: true })
      .eq("daily_room_tasks.date", today),
    supabase.from("daily_room_task_occurrences").select("id", { count: "exact", head: true }).in("status", ["pendente", "selecionada"]),
    supabase.from("daily_arrivals").select("id, guest_name, expected_time, rooms(number)").eq("date", today),
    supabase.from("daily_departures").select("id, guest_name, rooms(number)").eq("date", today),
    supabase.from("daily_breakfast_room_assignments").select("date, table_id, guest_count").in("date", [today, tomorrow]),
    getAvailableSuites(supabase),
    getRoomBillsOverview(),
    getTopConsumption(month, prevMonth),
  ]);

  type TaskRow = DailyRoomTask & { rooms: { number: string } | null; chooser: { name: string } | null; extra_cleaning: boolean };
  const todaySuites = ((tasks ?? []) as unknown as TaskRow[])
    .map((t) => ({
      id: t.id,
      room: t.rooms?.number ?? "—",
      label: taskTypeLabel(t.task_type as ChecklistType, t.extra_cleaning),
      status:
        t.status === "pendente" && t.assigned_to
          ? `Escolhida por ${t.chooser?.name ?? "—"}${t.claimed_at ? ` às ${formatTimePt(t.claimed_at)}` : ""}`
          : taskStatusLabel(t),
      done: t.status === "concluido",
    }))
    .sort((a, b) => roomNum(a.room) - roomNum(b.room));

  const arrivals = ((arrivalRows ?? []) as unknown as { id: string; guest_name: string | null; expected_time: string | null; rooms: { number: string } | null }[])
    .map((a) => ({ id: a.id, room: a.rooms?.number ?? "—", firstName: firstName(a.guest_name), time: a.expected_time ? a.expected_time.slice(0, 5) : null }))
    .sort((a, b) => roomNum(a.room) - roomNum(b.room));
  const departures = ((departureRows ?? []) as unknown as { id: string; guest_name: string | null; rooms: { number: string } | null }[])
    .map((d) => ({ id: d.id, room: d.rooms?.number ?? "—", firstName: firstName(d.guest_name) }))
    .sort((a, b) => roomNum(a.room) - roomNum(b.room));

  const asg = (assignments ?? []) as { date: string; table_id: string; guest_count: number }[];
  const day = (d: string) => {
    const list = asg.filter((a) => a.date === d);
    return { tables: new Set(list.map((a) => a.table_id)).size, guests: list.reduce((s, a) => s + a.guest_count, 0) };
  };

  const former = bills.filter((b) => !b.isWalkin && b.group === "former");
  const sum = (list: typeof former) => ({ count: list.length, total: list.reduce((s, b) => s + b.grandTotal, 0) });

  return {
    today,
    todaySuites,
    occurrences: { today: occToday ?? 0, open: occOpen ?? 0 },
    arrivals,
    departures,
    breakfast: { today: day(today), tomorrow: day(tomorrow) },
    suites: { clean: suites.limpas, dirty: suites.sujas },
    accounts: {
      open: bills.length,
      total: bills.reduce((s, b) => s + b.grandTotal, 0),
      checkoutOpen: sum(former.filter((b) => b.status !== "fechada")),
      checkoutClosed: sum(former.filter((b) => b.status === "fechada")),
    },
    top,
    monthLabels: { current: month, previous: prevMonth },
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
    booking: { average: number | null; count: number; items: ItemAverage[]; bySuite: { suite: string; average: number; count: number }[] } | null;
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
    const bySuiteMap = new Map<string, number[]>();
    reviews.reviews
      .filter((r) => r.channel === "bookingcom" && r.suite && r.rating !== null && r.rating > 0)
      .forEach((r) => bySuiteMap.set(r.suite as string, [...(bySuiteMap.get(r.suite as string) ?? []), r.rating as number]));
    const bySuite = Array.from(bySuiteMap.entries())
      .map(([suite, v]) => ({ suite, average: (v.reduce((a, c) => a + c, 0) / v.length) * 2, count: v.length }))
      .sort((a, c) => Number(a.suite) - Number(c.suite));
    const x2 = (v: number | null) => (v === null ? null : v * 2);
    revOut = {
      average: x2(avg(rated)),
      total: rated.length,
      last90: x2(avg(rated.filter((r) => r.day >= cutoff))),
      news: reviews.reviews.filter((r) => r.isNew).length,
      booking: b.count > 0 ? { average: x2(b.average), count: b.count, items: b.items.map((i) => ({ ...i, average: i.average * 2 })), bySuite } : null,
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

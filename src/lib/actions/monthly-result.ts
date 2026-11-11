"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import { addDaysKey, dateKeyInBrazil, nextDayBrasiliaUtcBoundary, startOfDayBrasiliaUtc, todayKey } from "@/lib/date";
import { SERVICE_CHARGE_RATE } from "@/lib/room-bills";
import { barShareFromQuantities, distributeByDays, splitAmountByCenters } from "@/lib/expense-allocation";
import type { CategoryRule, CenterCode } from "@/lib/expense-model-types";
import type { MonthlyResult, PendingRevenue, CategoryLine } from "@/lib/monthly-result-types";

type Result = { error?: string; success?: boolean };

const round2 = (v: number) => Math.round(v * 100) / 100;
const ROLES = ["admin"] as const;

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, "0")}` };
}

// O mês fecha no último dia; lançamentos valem automaticamente até a janela
// (padrão 30 dias). Depois disso, receita nova fica pendente de aprovação.
function windowEnd(last: string, windowDays: number) {
  return addDaysKey(last, windowDays);
}

interface BillInfo {
  id: string;
  status: string;
  closed_at: string | null;
  paid_at: string | null;
  service_charge_waived: boolean;
  guest_name_hint: string | null;
  room_id: string;
}

export async function getMonthlyResult(month: string): Promise<MonthlyResult | { error: string }> {
  const denied = await requireRole([...ROLES]);
  if (denied) return { error: denied.error };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { first, last } = monthBounds(month);
  const monthDate = first;
  const today = todayKey();

  const { data: settings } = await supabase.from("expense_settings").select("late_window_days, start_date").eq("id", true).single();
  const win = settings?.late_window_days ?? 30;
  const startDate = settings?.start_date ?? "2026-11-01";
  const limit = windowEnd(last, win);
  const windowClosed = today > limit;
  const monthClosed = today > last;

  // ---------- Hospedagem (Stays) ----------
  const { data: lodgingRows } = await supabase
    .from("indicator_month_channels")
    .select("revenue, commission_actual")
    .eq("month", monthDate);
  const liveGross = round2((lodgingRows ?? []).reduce((s, r) => s + Number(r.revenue), 0));
  const liveCommission = round2((lodgingRows ?? []).reduce((s, r) => s + Number(r.commission_actual), 0));

  let lodgingGross = liveGross;
  let lodgingCommission = liveCommission;
  let lodgingPending: { gross: number; commission: number } | null = null;
  if (windowClosed) {
    const { data: frozen } = await admin.from("lodging_month_freeze").select("gross, commission").eq("month", monthDate).maybeSingle();
    if (frozen) {
      lodgingGross = Number(frozen.gross);
      lodgingCommission = Number(frozen.commission);
      if (Math.abs(liveGross - lodgingGross) > 0.005 || Math.abs(liveCommission - lodgingCommission) > 0.005) {
        lodgingPending = { gross: round2(liveGross - lodgingGross), commission: round2(liveCommission - lodgingCommission) };
      }
    } else if ((lodgingRows ?? []).length > 0) {
      await admin.from("lodging_month_freeze").insert({ month: monthDate, gross: liveGross, commission: liveCommission });
    }
  }

  // ---------- Bar e frigobar (por data de lançamento) ----------
  const { data: approvals } = await supabase.from("revenue_approvals").select("bill_id, decision").eq("month", monthDate);
  const approvalByBill = new Map((approvals ?? []).map((a) => [a.bill_id as string, a.decision as string]));

  const fromTs = startOfDayBrasiliaUtc(first);
  const toTs = nextDayBrasiliaUtcBoundary(last);

  const { data: comandas } = await supabase
    .from("bar_comandas")
    .select(
      "id, bill_id, status, room_bills(id, room_id, status, closed_at, paid_at, service_charge_waived, guest_name_hint), bar_comanda_items(quantity, price_snapshot, poolbar_items(category))"
    )
    .gte("created_at", fromTs)
    .lt("created_at", toTs)
    .neq("status", "cancelada");

  const { data: launches } = await supabase
    .from("minibar_launches")
    .select("bill_id, delta, unit_price, room_bills(id, room_id, status, closed_at, paid_at, service_charge_waived, guest_name_hint)")
    .gte("launched_on", first)
    .lte("launched_on", last);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  // Situação da conta em relação ao mês: contada, a fechar, pendente de aprovação ou cancelada.
  function classify(bill: BillInfo | null): "contada" | "a_fechar" | "pendente" | "cancelada" {
    if (!bill) return "a_fechar";
    if (bill.status !== "fechada" && bill.status !== "paga") return "a_fechar";
    const closedAt = bill.closed_at ?? bill.paid_at;
    const closedDay = closedAt ? dateKeyInBrazil(closedAt) : today;
    if (closedDay <= limit) return "contada";
    const d = approvalByBill.get(bill.id);
    if (d === "aprovada") return "contada";
    if (d === "cancelada") return "cancelada";
    return "pendente";
  }

  const bar = { items: 0, service: 0, toClose: 0 };
  const frigobar = { total: 0, toClose: 0 };
  const pendingMap = new Map<string, PendingRevenue>();
  let barBeverageQty = 0;
  let minibarQty = 0;

  function addPending(bill: BillInfo, kind: "bar" | "frigobar", amount: number) {
    const key = `${bill.id}:${kind}`;
    const cur = pendingMap.get(key);
    if (cur) cur.amount = round2(cur.amount + amount);
    else
      pendingMap.set(key, {
        bill_id: bill.id,
        kind,
        amount: round2(amount),
        guest: bill.guest_name_hint,
        closed_day: bill.closed_at ? dateKeyInBrazil(bill.closed_at) : null,
      });
  }

  type ComandaRow = {
    bill_id: string;
    room_bills: BillInfo | BillInfo[] | null;
    bar_comanda_items: { quantity: number; price_snapshot: number | string; poolbar_items: { category: string | null } | { category: string | null }[] | null }[];
  };
  for (const c of (comandas ?? []) as unknown as ComandaRow[]) {
    const bill = one(c.room_bills);
    let sub = 0;
    for (const it of c.bar_comanda_items) {
      const v = it.quantity * Number(it.price_snapshot);
      sub += v;
      const cat = one(it.poolbar_items)?.category ?? "";
      if (/^bebida/i.test(cat)) barBeverageQty += it.quantity;
    }
    const service = bill?.service_charge_waived ? 0 : sub * SERVICE_CHARGE_RATE;
    const state = classify(bill);
    if (state === "contada") {
      bar.items += sub;
      bar.service += service;
    } else if (state === "a_fechar") bar.toClose += sub + service;
    else if (state === "pendente" && bill) addPending(bill, "bar", sub + service);
  }

  type LaunchRow = { delta: number; unit_price: number | string; room_bills: BillInfo | BillInfo[] | null };
  for (const l of (launches ?? []) as unknown as LaunchRow[]) {
    const bill = one(l.room_bills);
    const v = l.delta * Number(l.unit_price);
    minibarQty += l.delta;
    const state = classify(bill);
    if (state === "contada") frigobar.total += v;
    else if (state === "a_fechar") frigobar.toClose += v;
    else if (state === "pendente" && bill) addPending(bill, "frigobar", v);
  }

  // ---------- Despesas (rateio no tempo e entre centros) ----------
  const [{ data: cats }, { data: catCenters }, { data: ingredients }] = await Promise.all([
    supabase.from("expense_categories").select("id, name, consumption_days, rule"),
    supabase.from("expense_category_centers").select("category_id, center_code, pct"),
    supabase.from("ingredients").select("id, bar_pct"),
  ]);
  const catMap = new Map((cats ?? []).map((c) => [c.id as string, c]));
  const ingMap = new Map((ingredients ?? []).map((i) => [i.id as string, Number(i.bar_pct)]));

  const { data: lines } = await supabase
    .from("purchase_lines")
    .select("category_id, ingredient_id, amount, is_asset, purchases!inner(date, status)")
    .eq("is_asset", false)
    .eq("purchases.status", "registrada")
    .gte("purchases.date", startDate)
    .lte("purchases.date", last);

  const barShare = barShareFromQuantities(barBeverageQty, Math.max(0, minibarQty));
  const centers: CenterCode[] = ["hospedagem", "bar", "cafe", "frigobar"];
  const expByCenter: Record<CenterCode, number> = { hospedagem: 0, bar: 0, cafe: 0, frigobar: 0 };
  const catByCenter: Record<CenterCode, Map<string, number>> = {
    hospedagem: new Map(),
    bar: new Map(),
    cafe: new Map(),
    frigobar: new Map(),
  };
  let taxes = 0;

  type LineRow = { category_id: string | null; ingredient_id: string | null; amount: number | string; purchases: { date: string } | { date: string }[] };
  for (const l of (lines ?? []) as unknown as LineRow[]) {
    const cat = l.category_id ? catMap.get(l.category_id) : null;
    if (!cat) continue;
    const date = one(l.purchases)!.date;
    const portion = distributeByDays(date, Number(l.amount), cat.consumption_days)[month];
    if (!portion) continue;
    const rule = cat.rule as CategoryRule;
    if (rule === "nao_alocavel") {
      taxes += portion;
      continue;
    }
    const split = splitAmountByCenters(
      {
        amount: portion,
        rule,
        fixedCenters: (catCenters ?? [])
          .filter((x) => x.category_id === cat.id)
          .map((x) => ({ center_code: x.center_code as CenterCode, pct: Number(x.pct) })),
        ingredientBarPct: l.ingredient_id ? (ingMap.get(l.ingredient_id) ?? null) : null,
      },
      barShare
    );
    for (const c of centers) {
      const v = split[c] ?? 0;
      if (!v) continue;
      expByCenter[c] += v;
      catByCenter[c].set(cat.name, (catByCenter[c].get(cat.name) ?? 0) + v);
    }
  }

  const revenueByCenter: Record<CenterCode, number> = {
    hospedagem: round2(lodgingGross - lodgingCommission),
    bar: round2(bar.items + bar.service),
    cafe: 0,
    frigobar: round2(frigobar.total),
  };

  const byCenter = centers.map((c) => {
    const expenses = round2(expByCenter[c]);
    const categories: CategoryLine[] = [...catByCenter[c].entries()]
      .map(([name, amount]) => ({ name, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);
    return { center: c, revenue: revenueByCenter[c], expenses, result: round2(revenueByCenter[c] - expenses), categories };
  });

  const totalRevenue = round2(byCenter.reduce((s, c) => s + c.revenue, 0));
  const totalExpenses = round2(byCenter.reduce((s, c) => s + c.expenses, 0));

  const lateCount = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .gte("date", first)
    .lte("date", last)
    .eq("posted_after_close", true)
    .eq("status", "registrada");

  return {
    month,
    monthClosed,
    windowEnd: limit,
    windowClosed,
    lodging: {
      gross: lodgingGross,
      commission: lodgingCommission,
      net: round2(lodgingGross - lodgingCommission),
      pendingDiff: lodgingPending,
    },
    bar: { items: round2(bar.items), service: round2(bar.service), total: round2(bar.items + bar.service), toClose: round2(bar.toClose) },
    frigobar: { total: round2(frigobar.total), toClose: round2(frigobar.toClose) },
    byCenter,
    taxes: round2(taxes),
    totalRevenue,
    totalExpenses,
    totalBeforeTaxes: round2(totalRevenue - totalExpenses),
    operatingResult: round2(totalRevenue - totalExpenses - taxes),
    pendingRevenue: [...pendingMap.values()],
    lateExpensesCount: lateCount.count ?? 0,
    barShare,
  };
}

// Admin aprova ou cancela uma receita que chegou depois da janela de 30 dias.
export async function decideLateRevenue(billId: string, month: string, decision: "aprovada" | "cancelada"): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("revenue_approvals")
    .upsert({ bill_id: billId, month: `${month}-01`, decision, decided_by: user?.id ?? null, decided_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/contabil", "layout");
  return { success: true };
}

// Admin aceita a correção da Stays recebida depois da janela: atualiza o valor congelado.
export async function approveLodgingDifference(month: string): Promise<Result> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };
  const supabase = await createClient();
  const monthDate = `${month}-01`;
  const { data: rows } = await supabase.from("indicator_month_channels").select("revenue, commission_actual").eq("month", monthDate);
  const gross = round2((rows ?? []).reduce((s, r) => s + Number(r.revenue), 0));
  const commission = round2((rows ?? []).reduce((s, r) => s + Number(r.commission_actual), 0));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("lodging_month_freeze")
    .upsert({ month: monthDate, gross, commission, frozen_at: new Date().toISOString(), approved_by: user?.id ?? null });
  if (error) return { error: error.message };
  revalidatePath("/contabil", "layout");
  return { success: true };
}

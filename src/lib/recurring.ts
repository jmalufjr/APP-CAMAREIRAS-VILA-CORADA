// Itens recorrentes: lançamento automático, recuperação de meses perdidos, verificação de itens
// parecidos e substituição do lançamento automático pela nota real. Não é "use server":
// recebe o cliente do banco como parâmetro (use o cliente admin nas rotinas automáticas).
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysKey, dateKeyInBrazil, monthYearLabelPt, todayKey } from "@/lib/date";
import { similarSupplier } from "@/lib/purchase-duplicates";

export interface RecurringLite {
  id: string;
  name: string;
  category_id: string;
  amount: number | string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dmy = (d: string) => d.split("-").reverse().join("/");

export function nextMonthKey(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function prevMonthKey(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthEndKey(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
}

// Item parecido já cadastrado (ativo ou não): nome parecido, ou mesma categoria e mesmo valor.
export function similarRecurringIn<T extends RecurringLite>(
  items: T[],
  cand: { name: string; categoryId: string | null; amount: number },
  excludeId?: string
): T | null {
  for (const it of items) {
    if (excludeId && it.id === excludeId) continue;
    if (similarSupplier(cand.name, it.name)) return it;
    if (cand.categoryId && it.category_id === cand.categoryId && cand.amount > 0 && Math.abs(cand.amount - Number(it.amount)) < 0.005) return it;
  }
  return null;
}

export async function findSimilarRecurringItem(
  db: SupabaseClient,
  cand: { name: string; categoryId: string | null; amount: number },
  excludeId?: string
): Promise<(RecurringLite & { day_of_month: number }) | null> {
  const { data } = await db.from("recurring_expenses").select("id, name, category_id, amount, day_of_month");
  return similarRecurringIn((data ?? []) as (RecurringLite & { day_of_month: number })[], cand, excludeId);
}

export function describeRecurring(it: { name: string; amount: number | string; day_of_month?: number }): string {
  return `«${it.name}», ${brl(Number(it.amount))}${it.day_of_month ? `, todo dia ${it.day_of_month}` : ""}`;
}

// Lançamento avulso (feito à mão ou por nota) do mesmo mês, parecido com o item.
export async function findAvulsoInMonth(
  db: SupabaseClient,
  p: { name: string; categoryId: string | null; month: string }
): Promise<{ date: string; supplier: string; total: number } | null> {
  const { data } = await db
    .from("purchases")
    .select("date, supplier_name, total_amount, source, purchase_lines(description, category_id)")
    .gte("date", `${p.month}-01`)
    .lte("date", monthEndKey(p.month))
    .neq("status", "cancelada")
    .neq("source", "recorrente");
  for (const pur of data ?? []) {
    const lines = (pur.purchase_lines ?? []) as { description: string; category_id: string | null }[];
    const nameOk = similarSupplier(p.name, (pur.supplier_name as string | null) ?? "") || lines.some((l) => similarSupplier(p.name, l.description));
    const catOk = !p.categoryId || lines.some((l) => l.category_id === p.categoryId);
    if (nameOk && catOk) return { date: pur.date as string, supplier: (pur.supplier_name as string | null) ?? p.name, total: Number(pur.total_amount) };
  }
  return null;
}

// Cria as despesas dos itens recorrentes ativos: cada mês uma vez, no dia combinado, e recupera
// meses que ficaram sem lançamento (até 12 meses atrás; nunca antes do início do modelo nem do
// mês em que o item foi cadastrado).
export async function generateRecurringExpenses(db: SupabaseClient): Promise<{ created: number }> {
  const today = todayKey();
  const curMonth = today.slice(0, 7);
  const dayNow = Number(today.slice(8, 10));

  const { data: settings } = await db.from("expense_settings").select("start_date").eq("id", true).maybeSingle();
  const startDate = (settings?.start_date as string | undefined) ?? "2026-11-01";
  const startMonth = startDate.slice(0, 7);
  let floor = curMonth;
  for (let i = 0; i < 11; i++) floor = prevMonthKey(floor);

  const { data: items } = await db
    .from("recurring_expenses")
    .select("id, name, category_id, amount, day_of_month, last_generated_month, created_at")
    .eq("active", true);

  let created = 0;
  for (const it of items ?? []) {
    let marker: string | null = (it.last_generated_month as string | null) ?? null;
    let m = marker ? nextMonthKey(marker.slice(0, 7)) : dateKeyInBrazil(it.created_at as string).slice(0, 7);
    if (m < startMonth) m = startMonth;
    if (m < floor) m = floor;

    while (m <= curMonth) {
      const dayOfMonth = Number(it.day_of_month);
      if (m === curMonth && dayOfMonth > dayNow) break;
      const date = `${m}-${String(dayOfMonth).padStart(2, "0")}`;
      if (date >= startDate) {
        const mark = `${m}-01`;
        // Marca primeiro (evita duplicar se duas rotinas rodarem ao mesmo tempo).
        const { data: claimed } = await db
          .from("recurring_expenses")
          .update({ last_generated_month: mark })
          .eq("id", it.id)
          .or(`last_generated_month.is.null,last_generated_month.lt.${mark}`)
          .select("id");
        if (!claimed || claimed.length === 0) break;
        const previous = marker;
        marker = mark;

        const { data: p, error } = await db
          .from("purchases")
          .insert({ date, supplier_name: it.name, total_amount: it.amount, source: "recorrente" })
          .select("id")
          .single();
        if (error || !p) {
          await db.from("recurring_expenses").update({ last_generated_month: previous }).eq("id", it.id);
          break;
        }
        const { error: lErr } = await db
          .from("purchase_lines")
          .insert({ purchase_id: p.id, category_id: it.category_id, description: it.name, quantity: 1, amount: it.amount });
        if (lErr) {
          await db.from("purchases").delete().eq("id", p.id);
          await db.from("recurring_expenses").update({ last_generated_month: previous }).eq("id", it.id);
          break;
        }
        created++;
      }
      m = nextMonthKey(m);
    }
  }
  return { created };
}

// A nota real prevalece: se ela parece ser o comprovante de um item recorrente, o lançamento
// automático daquele mês é cancelado (ou, se ainda não existia, o mês é marcado como coberto).
// Limites de segurança (esta função roda com o cliente admin, inclusive a pedido do gerente):
// só age quando (1) a nota tem uma linha na MESMA categoria do item, (2) o mês ainda está dentro
// do prazo de lançamento (fechamento + tolerância), e (3) só cancela lançamentos automáticos
// registrados e com o nome exato do item — nunca compras normais nem pendentes de aprovação.
export async function applyReceiptToRecurring(
  db: SupabaseClient,
  p: { date: string; supplierName: string; descriptions: string[]; categoryIds: (string | null)[] }
): Promise<string | null> {
  const { data: items } = await db.from("recurring_expenses").select("id, name, category_id, amount, last_generated_month").eq("active", true);
  const item = (items ?? []).find(
    (it) =>
      p.categoryIds.includes(it.category_id as string) &&
      (similarSupplier(p.supplierName, it.name as string) || p.descriptions.some((d) => similarSupplier(d, it.name as string)))
  );
  if (!item) return null;

  const month = p.date.slice(0, 7);
  const monthStart = `${month}-01`;
  const { data: settings } = await db.from("expense_settings").select("late_window_days").eq("id", true).maybeSingle();
  const windowDays = (settings?.late_window_days as number | undefined) ?? 30;
  if (todayKey() > addDaysKey(monthEndKey(month), windowDays)) return null; // mês fora do prazo: nada é alterado

  const { data: autos } = await db
    .from("purchases")
    .select("id, supplier_name, total_amount")
    .eq("source", "recorrente")
    .eq("status", "registrada")
    .gte("date", monthStart)
    .lte("date", monthEndKey(month));
  const mine = (autos ?? []).filter((a) => String(a.supplier_name ?? "").trim().toLowerCase() === String(item.name).trim().toLowerCase());

  if (mine.length > 0) {
    for (const a of mine) {
      await db
        .from("purchases")
        .update({ status: "cancelada", notes: `Substituída pela nota de ${dmy(p.date)}` })
        .eq("id", a.id);
    }
    return `O lançamento automático de «${item.name}» deste mês (${brl(Number(mine[0].total_amount))}) foi substituído por esta nota.`;
  }
  const last = (item.last_generated_month as string | null) ?? null;
  if (!last || last < monthStart) {
    await db.from("recurring_expenses").update({ last_generated_month: monthStart }).eq("id", item.id);
    return `Esta nota cobre «${item.name}» de ${monthYearLabelPt(monthStart)}; o lançamento automático desse mês não será criado.`;
  }
  return null;
}

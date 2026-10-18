"use server";

import { createClient } from "@/lib/supabase/server";
import type { LedgerAccountGroup } from "@/lib/types";

// Relatórios contábeis lidos direto do livro de lançamentos (nunca
// persistem nada): Balancete analítico/sintético, Livro Razão e Livro
// caixa e bancos. Estornos entram como linhas espelhadas e se anulam
// sozinhos, por isso nenhuma query filtra por status.

export type Granularity = "dia" | "mes" | "ano";

const GROUP_ORDER: LedgerAccountGroup[] = ["ativo", "passivo", "receita", "custo", "despesa"];
const GROUP_LABELS: Record<LedgerAccountGroup, string> = {
  ativo: "Ativo",
  passivo: "Passivo",
  receita: "Receita",
  custo: "Custo",
  despesa: "Despesa",
};

interface Line {
  direction: "debito" | "credito";
  amount: number;
  account_code: string;
  account_name: string;
  display_code: string | null;
  group: LedgerAccountGroup;
  item_name: string | null;
  center_name: string | null;
  entry_date: string;
  cash_date: string | null;
  description: string;
  origin: string;
  created_at: string;
}

// Natureza da conta: ativo/custo/despesa aumentam com débito; passivo e
// receita aumentam com crédito.
function naturalSign(group: LedgerAccountGroup, direction: "debito" | "credito"): number {
  const debitNature = group === "ativo" || group === "custo" || group === "despesa";
  return (direction === "debito") === debitNature ? 1 : -1;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

async function fetchLines(to: string): Promise<Line[]> {
  const supabase = await createClient();
  const out: Line[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("ledger_entry_lines")
      .select(
        "direction, amount, cost_items(name), cost_centers(name), ledger_accounts!inner(code, name, display_code, account_group), ledger_entries!inner(entry_date, cash_date, description, origin, created_at)"
      )
      .lte("ledger_entries.entry_date", to)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error || !data) break;
    type Raw = {
      direction: "debito" | "credito";
      amount: number;
      cost_items: { name: string } | null;
      cost_centers: { name: string } | null;
      ledger_accounts: { code: string; name: string; display_code: string | null; account_group: LedgerAccountGroup };
      ledger_entries: { entry_date: string; cash_date: string | null; description: string; origin: string; created_at: string };
    };
    (data as unknown as Raw[]).forEach((r) =>
      out.push({
        direction: r.direction,
        amount: Number(r.amount),
        account_code: r.ledger_accounts.code,
        account_name: r.ledger_accounts.name,
        display_code: r.ledger_accounts.display_code,
        group: r.ledger_accounts.account_group,
        item_name: r.cost_items?.name ?? null,
        center_name: r.cost_centers?.name ?? null,
        entry_date: r.ledger_entries.entry_date,
        cash_date: r.ledger_entries.cash_date,
        description: r.ledger_entries.description,
        origin: r.ledger_entries.origin,
        created_at: r.ledger_entries.created_at,
      })
    );
    if (data.length < pageSize) break;
  }
  return out;
}

function bucketOf(date: string, g: Granularity): string {
  return g === "dia" ? date : g === "mes" ? date.slice(0, 7) : date.slice(0, 4);
}

function bucketLabel(b: string, g: Granularity): string {
  if (g === "dia") return b.split("-").reverse().join("/");
  if (g === "mes") return b.split("-").reverse().join("/");
  return b;
}

function accountOrder(a: Line, b: Line): number {
  const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (g !== 0) return g;
  return (a.display_code ?? a.account_code).localeCompare(b.display_code ?? b.account_code, "pt-BR", { numeric: true });
}

export interface BalanceteRow {
  period: string;
  group: string;
  account: string; // "1.04 — Estoque Central de bebidas"
  item: string; // só no analítico
  debits: number;
  credits: number;
  balance: number; // saldo acumulado ao fim do período, na natureza da conta
}

// Balancete: uma linha por período (dia/mês/ano) × conta [× item de
// custo, no analítico] com movimento, mostrando débitos, créditos e o
// saldo ACUMULADO até o fim daquele período (inclui tudo que veio antes
// do início do filtro).
async function buildBalancete(from: string, to: string, granularity: Granularity, analytic: boolean): Promise<BalanceteRow[]> {
  const lines = await fetchLines(to);
  const keyOf = (l: Line) => (analytic ? `${l.account_code}__${l.item_name ?? ""}` : l.account_code);

  // movimento por período e chave
  const movement = new Map<string, Map<string, { sample: Line; debits: number; credits: number }>>();
  lines.forEach((l) => {
    const b = bucketOf(l.entry_date, granularity);
    const perBucket = movement.get(b) ?? new Map();
    const k = keyOf(l);
    const cur = perBucket.get(k) ?? { sample: l, debits: 0, credits: 0 };
    if (l.direction === "debito") cur.debits += l.amount;
    else cur.credits += l.amount;
    perBucket.set(k, cur);
    movement.set(b, perBucket);
  });

  const buckets = [...movement.keys()].sort();
  const running = new Map<string, number>();
  const rows: (BalanceteRow & { _sample: Line })[] = [];
  buckets.forEach((b) => {
    const per = movement.get(b)!;
    per.forEach((m, k) => {
      const delta = (m.debits - m.credits) * naturalSign(m.sample.group, "debito");
      running.set(k, (running.get(k) ?? 0) + delta);
      // só mostra buckets que tocam o intervalo pedido
      const lastDay = granularity === "dia" ? b : granularity === "mes" ? `${b}-31` : `${b}-12-31`;
      const firstDay = granularity === "dia" ? b : granularity === "mes" ? `${b}-01` : `${b}-01-01`;
      if (lastDay < from || firstDay > to) return;
      rows.push({
        period: bucketLabel(b, granularity),
        group: GROUP_LABELS[m.sample.group],
        account: `${m.sample.display_code ? m.sample.display_code + " — " : ""}${m.sample.account_name}`,
        item: analytic ? (m.sample.item_name ?? "(sem item)") : "",
        debits: round2(m.debits),
        credits: round2(m.credits),
        balance: round2(running.get(k) ?? 0),
        _sample: m.sample,
        _bucket: b,
      } as BalanceteRow & { _sample: Line; _bucket: string });
    });
  });

  rows.sort((x, y) => {
    const bx = (x as unknown as { _bucket: string })._bucket;
    const by = (y as unknown as { _bucket: string })._bucket;
    if (bx !== by) return bx.localeCompare(by);
    const a = accountOrder(x._sample, y._sample);
    if (a !== 0) return a;
    return x.item.localeCompare(y.item, "pt-BR");
  });
  return rows.map(({ _sample, ...r }) => {
    void _sample;
    const { _bucket, ...rest } = r as BalanceteRow & { _bucket?: string };
    void _bucket;
    return rest;
  });
}

export async function getBalanceteAnalitico(from: string, to: string, granularity: Granularity) {
  return buildBalancete(from, to, granularity, true);
}

export async function getBalanceteSintetico(from: string, to: string, granularity: Granularity) {
  return buildBalancete(from, to, granularity, false);
}

export interface RazaoRow {
  account: string;
  date: string;
  description: string;
  center: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

// Livro Razão: lançamentos agrupados por conta, com o saldo corrente.
// Cada conta abre com o "Saldo anterior" (tudo antes do início do período).
export async function getLivroRazao(from: string, to: string, accountCode?: string): Promise<RazaoRow[]> {
  const lines = (await fetchLines(to)).filter((l) => !accountCode || l.account_code === accountCode);
  const byAccount = new Map<string, Line[]>();
  lines.forEach((l) => {
    const list = byAccount.get(l.account_code) ?? [];
    list.push(l);
    byAccount.set(l.account_code, list);
  });
  const accounts = [...byAccount.values()].sort((a, b) => accountOrder(a[0], b[0]));
  const rows: RazaoRow[] = [];
  accounts.forEach((list) => {
    const sample = list[0];
    const accName = `${sample.display_code ? sample.display_code + " — " : ""}${sample.account_name}`;
    const sorted = [...list].sort((x, y) => x.entry_date.localeCompare(y.entry_date) || x.created_at.localeCompare(y.created_at));
    let balance = 0;
    const inPeriod: Line[] = [];
    sorted.forEach((l) => {
      if (l.entry_date < from) balance += l.amount * naturalSign(l.group, l.direction);
      else inPeriod.push(l);
    });
    if (inPeriod.length === 0) return;
    rows.push({ account: accName, date: "", description: "Saldo anterior", center: "", debit: null, credit: null, balance: round2(balance) });
    inPeriod.forEach((l) => {
      balance += l.amount * naturalSign(l.group, l.direction);
      rows.push({
        account: accName,
        date: l.entry_date.split("-").reverse().join("/"),
        description: l.description,
        center: l.center_name ?? "",
        debit: l.direction === "debito" ? round2(l.amount) : null,
        credit: l.direction === "credito" ? round2(l.amount) : null,
        balance: round2(balance),
      });
    });
  });
  return rows;
}

export interface CashBankFilters {
  from: string;
  to: string;
  account?: "caixa" | "banco" | "todos";
  text?: string;
  min?: number;
  max?: number;
}

export interface CashBankRow {
  date: string;
  account: string;
  description: string;
  origin: string;
  inflow: number | null;
  outflow: number | null;
  balance: number;
}

const ORIGIN_LABELS: Record<string, string> = {
  despesa: "Compra/despesa",
  recebimento: "Recebimento de consumo",
  pagamento: "Pagamento de obrigação",
  estorno: "Estorno",
  manual: "Lançamento manual",
};

// Livro caixa e bancos: entradas e saídas de Caixa (dinheiro) e Banco
// (PIX, cartão, transferência…) em ordem cronológica, com o saldo real
// corrente de cada conta (os filtros só escondem linhas, nunca mudam o
// saldo).
export async function getLivroCaixaBancos(f: CashBankFilters): Promise<CashBankRow[]> {
  const lines = (await fetchLines(f.to)).filter((l) => l.account_code === "caixa" || l.account_code === "banco");
  const wanted = f.account && f.account !== "todos" ? f.account : null;
  const dateOf = (l: Line) => l.cash_date ?? l.entry_date;
  const sorted = [...lines].sort((x, y) => dateOf(x).localeCompare(dateOf(y)) || x.created_at.localeCompare(y.created_at));
  const balances: Record<string, number> = { caixa: 0, banco: 0 };
  const text = f.text?.trim().toLowerCase();
  const out: CashBankRow[] = [];
  sorted.forEach((l) => {
    balances[l.account_code] += l.direction === "debito" ? l.amount : -l.amount;
    const d = dateOf(l);
    if (d < f.from || d > f.to) return;
    if (wanted && l.account_code !== wanted) return;
    if (text && !l.description.toLowerCase().includes(text)) return;
    if (f.min !== undefined && !Number.isNaN(f.min) && l.amount < f.min) return;
    if (f.max !== undefined && !Number.isNaN(f.max) && l.amount > f.max) return;
    out.push({
      date: d.split("-").reverse().join("/"),
      account: l.account_code === "caixa" ? "Caixa" : "Banco",
      description: l.description,
      origin: ORIGIN_LABELS[l.origin] ?? l.origin,
      inflow: l.direction === "debito" ? round2(l.amount) : null,
      outflow: l.direction === "credito" ? round2(l.amount) : null,
      balance: round2(balances[l.account_code]),
    });
  });
  return out;
}

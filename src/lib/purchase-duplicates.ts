// Detecção de possível compra duplicada (por conteúdo, não pela identidade da mensagem).
// Só AVISA: a pessoa sempre pode confirmar que é outra compra.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DupCandidate {
  key: string;
  date: string; // YYYY-MM-DD
  supplier: string;
  docNumber: string;
  total: number | null;
}

export interface DupMatch {
  source: "compra" | "caixa" | "recorrente";
  date: string;
  supplier: string;
  total: number;
  reason: string;
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(ltda|me|epp|eireli|sa|s a|cia|comercio|comercial|de|da|do|dos|das|e)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function similarSupplier(a: string, b: string): boolean {
  const x = strip(a);
  const y = strip(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return true;
  const tx = new Set(x.split(" ").filter((t) => t.length > 2));
  const ty = new Set(y.split(" ").filter((t) => t.length > 2));
  if (tx.size === 0 || ty.size === 0) return false;
  let common = 0;
  tx.forEach((t) => ty.has(t) && common++);
  return common / Math.min(tx.size, ty.size) >= 0.6;
}

export function normalizeDoc(d: string): string {
  const digits = (d ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 3 ? digits : "";
}

function daysApart(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.abs(Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 86400000;
}

// Motivo pelo qual `cand` parece ser a mesma compra que `ex`, ou null.
export function matchReason(cand: DupCandidate, ex: { date: string; supplier: string; docNumber: string; total: number }): string | null {
  const sameTotal = cand.total !== null && Math.abs(cand.total - ex.total) < 0.005;
  const supplierOk = similarSupplier(cand.supplier, ex.supplier);
  const cd = normalizeDoc(cand.docNumber);
  const ed = normalizeDoc(ex.docNumber);
  if (cd && ed && cd === ed && (supplierOk || sameTotal)) return `mesmo número de nota (${cand.docNumber})`;
  if (sameTotal && daysApart(cand.date, ex.date) <= 3 && (supplierOk || !cand.supplier.trim() || !ex.supplier.trim())) {
    return "mesmo valor, em data próxima";
  }
  return null;
}

// Compara cada candidato com as compras já lançadas (e, entre si, com os candidatos anteriores da lista).
export async function findDuplicates(
  supabase: SupabaseClient,
  cands: DupCandidate[],
  options: { compareAmongThemselves?: boolean } = {}
): Promise<Record<string, DupMatch[]>> {
  const usable = cands.filter((c) => c.total !== null && c.total > 0 || normalizeDoc(c.docNumber));
  const out: Record<string, DupMatch[]> = {};
  if (usable.length === 0) return out;

  const { data: settings } = await supabase.from("expense_settings").select("start_date").eq("id", true).maybeSingle();
  const start = (settings?.start_date as string | undefined) ?? "2026-11-01";
  const { data: purchases } = await supabase
    .from("purchases")
    .select("date, supplier_name, document_number, total_amount, source")
    .gte("date", start)
    .neq("status", "cancelada")
    .limit(3000);

  const { data: recurringItems } = await supabase.from("recurring_expenses").select("name, amount").eq("active", true);

  usable.forEach((c, i) => {
    const matches: DupMatch[] = [];
    for (const p of purchases ?? []) {
      if ((p.source as string | null) === "recorrente") continue; // coberto pelo reconhecimento do item recorrente, abaixo
      const reason = matchReason(c, {
        date: p.date as string,
        supplier: (p.supplier_name as string | null) ?? "",
        docNumber: (p.document_number as string | null) ?? "",
        total: Number(p.total_amount),
      });
      if (reason) matches.push({ source: "compra", date: p.date as string, supplier: (p.supplier_name as string | null) ?? "Sem fornecedor", total: Number(p.total_amount), reason });
    }
    for (const it of recurringItems ?? []) {
      if (similarSupplier(c.supplier, it.name as string)) {
        matches.push({ source: "recorrente", date: c.date, supplier: it.name as string, total: Number(it.amount), reason: "comprovante de item recorrente" });
      }
    }
    if (options.compareAmongThemselves) {
      for (let j = 0; j < i; j++) {
        const o = usable[j];
        const reason = matchReason(c, { date: o.date, supplier: o.supplier, docNumber: o.docNumber, total: o.total ?? 0 });
        if (reason) matches.push({ source: "caixa", date: o.date, supplier: o.supplier || "Sem fornecedor", total: o.total ?? 0, reason });
      }
    }
    if (matches.length > 0) out[c.key] = matches.slice(0, 3);
  });
  return out;
}

export function describeMatch(m: DupMatch): string {
  if (m.source === "recorrente") {
    const v0 = m.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return `item recorrente «${m.supplier}» (${v0}): ao lançar esta nota, o lançamento automático do mês é substituído`;
  }
  const d = m.date.split("-").reverse().join("/");
  const v = m.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `${m.source === "compra" ? "compra já lançada" : "outra nota na caixa"}: ${m.supplier}, ${v}, ${d} (${m.reason})`;
}

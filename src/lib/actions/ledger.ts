"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { LedgerAccount, LedgerAccountGroup } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/contabil", "layout");
}

// ---------- Plano de contas contábil ----------
// Dimensão "que TIPO de movimento é isso" (Ativo/Passivo/Receita/Custo/
// Despesa) — nunca confundir com "centro de custo" (de qual PARTE da
// pousada é isso, em src/lib/actions/cost-plan.ts). Editável pelo
// admin, mas já nasce com a estrutura inteira do documento (ver
// migration 068) — ver PRD_compras&contabil.md seção 22.

export async function getLedgerAccounts(): Promise<LedgerAccount[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("ledger_accounts").select("*").order("position").order("display_code");
  return (data ?? []) as LedgerAccount[];
}

// O `code` (identificador estável usado pelo código do app pra saber
// qual conta usar em cada lançamento automático) só é definido na
// criação — nunca editável depois, pra nenhum lançamento automático
// quebrar silenciosamente se o admin renomear a chave.
export async function createLedgerAccount(
  code: string,
  name: string,
  accountGroup: LedgerAccountGroup,
  requiresCostCenter: boolean,
  displayCode: string | null
) {
  if (!code.trim() || !name.trim()) return { error: "Informe o código e o nome da conta." };
  const supabase = await createClient();
  const { error } = await supabase.from("ledger_accounts").insert({
    code: code.trim(),
    name: name.trim(),
    account_group: accountGroup,
    requires_cost_center: requiresCostCenter,
    display_code: displayCode?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma conta com esse código." };
    return { error: error.message };
  }
  revalidateAll();
  return { success: true };
}

export async function updateLedgerAccount(
  id: string,
  name: string,
  active: boolean,
  requiresCostCenter: boolean,
  displayCode: string | null
) {
  if (!name.trim()) return { error: "Informe o nome da conta." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ledger_accounts")
    .update({ name: name.trim(), active, requires_cost_center: requiresCostCenter, display_code: displayCode?.trim() || null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// Saldo atual (até hoje) de Caixa e Banco (PRD seção 9.1, Módulo
// Contábil Leva 6) — soma TODAS as linhas de TODOS os lançamentos
// dessas 2 contas (confirmado e estornado misturados, nunca filtrado
// por status): um lançamento estornado já tem, por definição, uma
// linha espelhada que cancela o efeito da original — filtrar por
// status quebraria essa simetria (excluiria só a original, contando a
// reversão sozinha). Débito aumenta o saldo (contas de ativo), crédito
// diminui.
export interface CashAndBankBalances {
  caixa: number;
  banco: number;
}

export async function getCashAndBankBalances(): Promise<CashAndBankBalances> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ledger_entry_lines")
    .select("direction, amount, ledger_accounts!inner(code)")
    .in("ledger_accounts.code", ["caixa", "banco"]);

  type Raw = { direction: "debito" | "credito"; amount: number; ledger_accounts: { code: string } };
  const balances: CashAndBankBalances = { caixa: 0, banco: 0 };
  ((data ?? []) as unknown as Raw[]).forEach((l) => {
    const signedAmount = l.direction === "debito" ? Number(l.amount) : -Number(l.amount);
    if (l.ledger_accounts.code === "caixa") balances.caixa += signedAmount;
    else if (l.ledger_accounts.code === "banco") balances.banco += signedAmount;
  });
  return balances;
}

// ---------- Lançamentos (partidas dobradas) ----------

export interface LedgerEntryLineInput {
  account_code: string;
  cost_center_id: string | null;
  // Produto/despesa de origem — alimenta o balancete analítico.
  cost_item_id?: string | null;
  direction: "debito" | "credito";
  amount: number;
}

// Único jeito de criar um lançamento — sempre via a função
// `post_ledger_entry` (security definer), que confere débitos=créditos
// antes de gravar qualquer coisa. Usado tanto por um lançamento manual
// (tela "Livro de lançamentos") quanto, nas próximas levas, por outras
// Server Actions (compras, vendas do bar, pagamentos) que precisam
// registrar o efeito contábil de algo que a pessoa já fez numa tela
// comum, sem ela precisar entender débito/crédito.
export async function postLedgerEntry(
  entryDate: string,
  documentDate: string | null,
  cashDate: string | null,
  description: string,
  origin: string,
  sourceType: string | null,
  sourceId: string | null,
  lines: LedgerEntryLineInput[]
): Promise<{ success?: boolean; entryId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_ledger_entry", {
    p_entry_date: entryDate,
    p_document_date: documentDate,
    p_cash_date: cashDate,
    p_description: description,
    p_origin: origin,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_lines: lines,
  });
  if (error) return { error: error.message };
  return { success: true, entryId: data as string };
}

export async function createManualLedgerEntry(
  entryDate: string,
  description: string,
  lines: LedgerEntryLineInput[]
) {
  if (!description.trim()) return { error: "Informe uma descrição pro lançamento." };
  if (lines.length < 2) return { error: "Um lançamento precisa de pelo menos 2 linhas." };
  const result = await postLedgerEntry(entryDate, entryDate, entryDate, description.trim(), "manual", null, null, lines);
  if (result.error) return { error: result.error };
  revalidateAll();
  return { success: true };
}

export async function reverseLedgerEntryAction(entryId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_ledger_entry", { p_entry_id: entryId, p_reason: reason || null });
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export interface LedgerEntryRow {
  id: string;
  entry_date: string;
  document_date: string | null;
  cash_date: string | null;
  description: string;
  origin: string;
  status: "confirmado" | "estornado";
  reverses_entry_id: string | null;
  created_by_name: string | null;
  created_at: string;
  lines: { account_code: string; account_name: string; cost_center_name: string | null; direction: "debito" | "credito"; amount: number }[];
}

// Livro de lançamentos — lista bruta, mais recente primeiro, com as
// linhas já embutidas (sem round trip extra por lançamento ao expandir
// o detalhe na tela).
export async function getLedgerEntries(from: string, to: string): Promise<LedgerEntryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ledger_entries")
    .select(
      "id, entry_date, document_date, cash_date, description, origin, status, reverses_entry_id, created_at, profiles(name), ledger_entry_lines(direction, amount, ledger_accounts(code, name), cost_centers(name))"
    )
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  type Raw = {
    id: string;
    entry_date: string;
    document_date: string | null;
    cash_date: string | null;
    description: string;
    origin: string;
    status: "confirmado" | "estornado";
    reverses_entry_id: string | null;
    created_at: string;
    profiles: { name: string } | null;
    ledger_entry_lines: {
      direction: "debito" | "credito";
      amount: number;
      ledger_accounts: { code: string; name: string } | null;
      cost_centers: { name: string } | null;
    }[];
  };

  return ((data ?? []) as unknown as Raw[]).map((e) => ({
    id: e.id,
    entry_date: e.entry_date,
    document_date: e.document_date,
    cash_date: e.cash_date,
    description: e.description,
    origin: e.origin,
    status: e.status,
    reverses_entry_id: e.reverses_entry_id,
    created_by_name: e.profiles?.name ?? null,
    created_at: e.created_at,
    lines: e.ledger_entry_lines.map((l) => ({
      account_code: l.ledger_accounts?.code ?? "—",
      account_name: l.ledger_accounts?.name ?? "—",
      cost_center_name: l.cost_centers?.name ?? null,
      direction: l.direction,
      amount: Number(l.amount),
    })),
  }));
}

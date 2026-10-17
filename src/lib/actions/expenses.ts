"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { uploadExpenseReceipt, signExpenseReceiptUrl } from "@/lib/expense-receipts";
import { postLedgerEntry } from "@/lib/actions/ledger";
import type { LedgerEntryLineInput } from "@/lib/actions/ledger";
import type { SupplierPaymentMethod, ExpensePaymentStatus } from "@/lib/types";
import { nowInBrazil, toDateKey } from "@/lib/date";

function revalidateAll() {
  revalidatePath("/compras", "layout");
  revalidatePath("/manutencao/compras", "layout");
  revalidatePath("/custos-despesas", "layout");
  revalidatePath("/ativo-permanente", "layout");
  revalidatePath("/checklists", "layout");
  revalidatePath("/contabil", "layout");
  revalidatePath("/dashboard");
}

export interface ExpenseItemInput {
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  // Desconto/frete/tributos (Módulo Contábil Leva 2, PRD seção 4.1) —
  // `subtotal` acima já vem calculado pelo formulário como o custo
  // líquido final (quantidade×custo − desconto + frete + tributo não
  // recuperável); estes 4 campos só ficam guardados à parte, pra
  // transparência/auditoria, nunca recalculados aqui. Tributo
  // recuperável nunca compõe o custo (PRD seção 6.7).
  discount: number;
  freight_and_other_costs: number;
  recoverable_tax: number;
  non_recoverable_tax: number;
  // Unidade de compra digitada (ex.: "caixa"): quantity/unit_cost acima já
  // vêm convertidos pra unidade-base do produto; estes 3 ficam só pra
  // exibir/auditar o que foi digitado. expiry_date = validade do lote.
  purchase_quantity?: number | null;
  purchase_unit?: string | null;
  purchase_unit_cost?: number | null;
  expiry_date?: string | null;
  // Compra destinada ao café da manhã: custo reconhecido na compra (centro
  // Café da manhã) e a linha NÃO entra no estoque.
  for_breakfast?: boolean;
  // Rateio próprio desta linha de despesa entre centros de custo
  // (substitui o padrão do item de custo): soma sempre 100%.
  center_split?: { center_id: string; alloc_pct: number }[] | null;
  // Linha já ligada a um item de custo existente.
  cost_item_id: string | null;
  // Linha que cria um item de custo novo na hora (Plano de Contas) —
  // ver resolveOrCreateCostItemId.
  new_cost_item?: {
    name: string;
    is_inventory: boolean;
    inventory_item_id: string | null;
    center_links: { center_id: string; alloc_pct: number }[];
  } | null;
  // Linha de ativo permanente — cria 1 bem novo (cada compra é uma
  // unidade física própria, nunca reaproveita um bem já existente).
  new_fixed_asset?: {
    category_id: string;
    catalog_item_id: string | null;
    brand: string | null;
    model: string | null;
    warranty_until: string | null;
    location: string | null;
    notes: string | null;
  } | null;
  // Linha que já estava ligada a um bem de ativo permanente (edição de
  // uma despesa já salva) — atualiza o bem existente em vez de criar um
  // novo a cada edição.
  existing_fixed_asset_id?: string | null;
}

// Resolve o item de custo de uma linha: usa o vinculado (se houver) ou
// cria um novo (se pedido), incluindo o item de estoque por trás dele
// quando representa estoque. Pra nunca duplicar um item de estoque já
// existente por causa de maiúscula/minúscula, confere por nome exato
// antes de criar (ver PRD_compras.md seção 16.6).
async function resolveOrCreateCostItemId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  item: ExpenseItemInput
): Promise<{ id: string | null; error?: string }> {
  if (item.cost_item_id) return { id: item.cost_item_id };
  if (!item.new_cost_item) return { id: null };

  const name = item.new_cost_item.name.trim() || item.description.trim();
  if (!name) return { id: null };

  let inventoryItemId: string | null = null;
  if (item.new_cost_item.is_inventory) {
    if (item.new_cost_item.inventory_item_id) {
      inventoryItemId = item.new_cost_item.inventory_item_id;
    } else {
      const { data: existing } = await supabase.from("inventory_items").select("id").ilike("name", name).maybeSingle();
      if (existing) {
        inventoryItemId = existing.id as string;
      } else {
        const { data: created, error } = await supabase.from("inventory_items").insert({ name, unit: "un" }).select("id").single();
        if (error || !created) return { id: null, error: error?.message ?? "Erro ao criar item de estoque." };
        inventoryItemId = created.id as string;
      }
    }
  }

  const links = item.new_cost_item.center_links.filter((l) => l.center_id);
  if (links.length > 0) {
    const sum = links.reduce((s, l) => s + l.alloc_pct, 0);
    if (sum !== 100) return { id: null, error: `Os percentuais dos centros do novo item de custo precisam somar 100% (soma atual: ${sum}%).` };
  }

  const { data: createdItem, error: itemError } = await supabase
    .from("cost_items")
    .insert({ name, is_inventory: item.new_cost_item.is_inventory, inventory_item_id: inventoryItemId })
    .select("id")
    .single();
  if (itemError || !createdItem) return { id: null, error: itemError?.message ?? "Erro ao criar item de custo." };

  if (links.length > 0) {
    const { error: linkError } = await supabase
      .from("cost_item_centers")
      .insert(links.map((l) => ({ cost_item_id: createdItem.id, center_id: l.center_id, alloc_pct: l.alloc_pct })));
    if (linkError) return { id: null, error: linkError.message };
  }

  return { id: createdItem.id as string };
}

// Resolve o bem de ativo permanente de uma linha: atualiza o já
// existente (edição de uma despesa já salva, nunca cria um bem novo
// nesse caso) ou cria 1 bem novo (linha nova de ativo permanente).
async function upsertFixedAssetForLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  item: ExpenseItemInput,
  date: string,
  supplierId: string | null,
  userId: string | null
): Promise<{ id: string | null; error?: string }> {
  if (item.existing_fixed_asset_id) {
    const { error } = await supabase
      .from("fixed_assets")
      .update({ name: item.description.trim(), purchase_value: item.subtotal })
      .eq("id", item.existing_fixed_asset_id);
    if (error) return { id: null, error: error.message };
    return { id: item.existing_fixed_asset_id };
  }

  if (!item.new_fixed_asset) return { id: null };
  const { data, error } = await supabase
    .from("fixed_assets")
    .insert({
      category_id: item.new_fixed_asset.category_id,
      catalog_item_id: item.new_fixed_asset.catalog_item_id,
      name: item.description.trim(),
      brand: item.new_fixed_asset.brand,
      model: item.new_fixed_asset.model,
      purchase_date: date,
      purchase_value: item.subtotal,
      warranty_until: item.new_fixed_asset.warranty_until,
      supplier_id: supplierId,
      location: item.new_fixed_asset.location,
      notes: item.new_fixed_asset.notes,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Erro ao registrar o ativo permanente." };
  return { id: data.id as string };
}

interface ResolvedExpenseRow {
  cost_item_id: string | null;
  fixed_asset_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  discount: number;
  freight_and_other_costs: number;
  recoverable_tax: number;
  non_recoverable_tax: number;
  purchase_quantity: number | null;
  purchase_unit: string | null;
  purchase_unit_cost: number | null;
  expiry_date: string | null;
  for_breakfast: boolean;
  center_split: { center_id: string; alloc_pct: number }[] | null;
}

async function resolveExpenseItemsForInsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: ExpenseItemInput[],
  date: string,
  supplierId: string | null,
  userId: string | null
): Promise<{ rows?: ResolvedExpenseRow[]; error?: string }> {
  const rows: ResolvedExpenseRow[] = [];
  for (const i of items) {
    let costItemId: string | null = null;
    let fixedAssetId: string | null = null;

    if (i.existing_fixed_asset_id || i.new_fixed_asset) {
      const resolved = await upsertFixedAssetForLine(supabase, i, date, supplierId, userId);
      if (resolved.error) return { error: resolved.error };
      fixedAssetId = resolved.id;
    } else {
      const resolved = await resolveOrCreateCostItemId(supabase, i);
      if (resolved.error) return { error: resolved.error };
      costItemId = resolved.id;
    }

    rows.push({
      cost_item_id: costItemId,
      fixed_asset_id: fixedAssetId,
      description: i.description,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.subtotal,
      discount: i.discount || 0,
      freight_and_other_costs: i.freight_and_other_costs || 0,
      recoverable_tax: i.recoverable_tax || 0,
      non_recoverable_tax: i.non_recoverable_tax || 0,
      purchase_quantity: i.purchase_quantity ?? null,
      purchase_unit: i.purchase_unit ?? null,
      purchase_unit_cost: i.purchase_unit_cost ?? null,
      expiry_date: i.expiry_date || null,
      for_breakfast: !!i.for_breakfast && !i.existing_fixed_asset_id && !i.new_fixed_asset,
      center_split: i.center_split && i.center_split.length > 0 ? i.center_split : null,
    });
  }
  return { rows };
}

// Histórico legível do lançamento no Livro Diário: tipo, itens, documento e observação.
function ledgerDescription(
  f: { document_number: string | null; notes: string | null },
  rows: { description: string; fixed_asset_id: string | null; for_breakfast: boolean }[]
): string {
  const kind = rows.some((r) => r.fixed_asset_id) ? "Compra de ativo" : "Compra/despesa";
  const items = rows.map((r) => r.description).filter(Boolean).slice(0, 4).join(", ");
  const extra = rows.length > 4 ? ` e mais ${rows.length - 4}` : "";
  return [kind + (items ? ` — ${items}${extra}` : ""), f.document_number ? `doc. ${f.document_number}` : "", f.notes?.trim() ?? ""]
    .filter(Boolean)
    .join(" · ");
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Qual conta do plano de contas CONTÁBIL um item de custo posta — usa
// `ledger_account_code` quando o admin já configurou (tela "Plano de
// itens de custo"), senão cai num padrão genérico (estoque-outros se
// representa estoque, outras-despesas se não).
async function resolveLedgerAccountForCostItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  costItemId: string
): Promise<{ accountCode: string; requiresCostCenter: boolean }> {
  const { data: item } = await supabase
    .from("cost_items")
    .select("ledger_account_code, is_inventory")
    .eq("id", costItemId)
    .maybeSingle();
  const fallbackCode = item?.is_inventory ? "estoque-outros" : "outras-despesas";
  const code = item?.ledger_account_code ?? fallbackCode;
  const { data: account } = await supabase.from("ledger_accounts").select("requires_cost_center").eq("code", code).maybeSingle();
  return { accountCode: code, requiresCostCenter: account?.requires_cost_center ?? true };
}

// Lançamento contábil automático de uma compra/despesa (Módulo Contábil
// Leva 2): débito em 1+ contas de custo/despesa/estoque/ativo
// (repartido por centro de custo quando o item de custo pertence a
// mais de um, na mesma proporção já cadastrada no Plano de Contas) /
// crédito em 1 conta só — Caixa ou Banco se já paga, Fornecedores a
// pagar (ou Despesas a pagar, sem fornecedor) se "a prazo". Nunca
// bloqueia o lançamento da despesa em si se isso falhar — a compra já
// está salva e correta operacionalmente; o erro só é devolvido como
// aviso.
async function postExpenseLedgerEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
  description: string,
  competenceDate: string,
  documentDate: string,
  paymentStatus: ExpensePaymentStatus,
  paymentMethod: SupplierPaymentMethod | null,
  supplierId: string | null,
  totalAmount: number,
  rows: ResolvedExpenseRow[]
): Promise<{ error?: string }> {
  const debitLines: LedgerEntryLineInput[] = [];

  for (const row of rows) {
    if (row.fixed_asset_id) {
      debitLines.push({ account_code: "equipamentos-imobilizado", cost_center_id: null, direction: "debito", amount: row.subtotal });
      continue;
    }
    if (!row.cost_item_id) continue;

    // Compra pro café da manhã: custo na hora, centro "Café da manhã", sem estoque.
    if (row.for_breakfast) {
      const { data: cafe } = await supabase.from("cost_centers").select("id").eq("name", "Café da manhã").maybeSingle();
      debitLines.push({ account_code: "custo-cafe-manha", cost_center_id: cafe?.id ?? null, cost_item_id: row.cost_item_id, direction: "debito", amount: row.subtotal });
      continue;
    }

    const { accountCode, requiresCostCenter } = await resolveLedgerAccountForCostItem(supabase, row.cost_item_id);
    if (!requiresCostCenter) {
      debitLines.push({ account_code: accountCode, cost_center_id: null, cost_item_id: row.cost_item_id, direction: "debito", amount: row.subtotal });
      continue;
    }

    let links: { center_id: string | null; alloc_pct: number }[];
    if (row.center_split && row.center_split.length > 0) {
      links = row.center_split;
    } else {
      const { data: centerLinks } = await supabase.from("cost_item_centers").select("center_id, alloc_pct").eq("cost_item_id", row.cost_item_id);
      links = centerLinks && centerLinks.length > 0 ? centerLinks : [{ center_id: null, alloc_pct: 100 }];
    }
    links.forEach((link) => {
      debitLines.push({
        account_code: accountCode,
        cost_center_id: link.center_id,
        cost_item_id: row.cost_item_id,
        direction: "debito",
        amount: round2(row.subtotal * (Number(link.alloc_pct) / 100)),
      });
    });
  }

  if (debitLines.length === 0) return {};

  // Corrige sobra de arredondamento (rateio por % de um valor quebrado)
  // na última linha, pra garantir que a soma bate exatamente o total.
  const sumDebit = round2(debitLines.reduce((s, l) => s + l.amount, 0));
  const diff = round2(totalAmount - sumDebit);
  if (diff !== 0) debitLines[debitLines.length - 1].amount = round2(debitLines[debitLines.length - 1].amount + diff);

  let creditAccount: string;
  if (paymentStatus === "pendente") {
    creditAccount = supplierId ? "fornecedores-a-pagar" : "despesas-a-pagar";
  } else {
    creditAccount = paymentMethod === "dinheiro" ? "caixa" : "banco";
  }

  const result = await postLedgerEntry(
    competenceDate,
    documentDate,
    paymentStatus === "pago" ? documentDate : null,
    description,
    "despesa",
    "expenses",
    expenseId,
    [...debitLines, { account_code: creditAccount, cost_center_id: null, direction: "credito", amount: totalAmount }]
  );
  return result.error ? { error: result.error } : {};
}

// Confere se já existe uma despesa muito parecida (mesmo fornecedor +
// número do documento + data + valor) — só AVISA (nunca bloqueia: duas
// notas iguais por coincidência existem de verdade), ver
// PRD_compras&contabil.md seção 22.3 item 6.
async function findLikelyDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  supplierId: string | null,
  documentNumber: string | null,
  date: string,
  totalAmount: number,
  excludeId?: string
): Promise<boolean> {
  if (!documentNumber) return false;
  let query = supabase
    .from("expenses")
    .select("id")
    .eq("document_number", documentNumber)
    .eq("date", date)
    .eq("total_amount", totalAmount);
  query = supplierId ? query.eq("supplier_id", supplierId) : query.is("supplier_id", null);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1);
  return (data ?? []).length > 0;
}

interface ExpenseFormFields {
  date: string;
  competence_date: string;
  document_number: string | null;
  supplier_id: string | null;
  payment_method: SupplierPaymentMethod | null;
  due_date: string | null;
  nfce_url: string | null;
  notes: string | null;
  total_amount: number;
  items: ExpenseItemInput[];
  confirm_duplicate: boolean;
}

function parseExpenseFormData(formData: FormData): { error?: string; fields?: ExpenseFormFields } {
  const date = String(formData.get("date") ?? "").trim() || toDateKey(nowInBrazil());
  const competence_date = String(formData.get("competence_date") ?? "").trim() || date;
  const document_number = String(formData.get("document_number") ?? "").trim() || null;
  const supplier_id = String(formData.get("supplier_id") ?? "").trim() || null;
  const payment_method = (String(formData.get("payment_method") ?? "").trim() || null) as SupplierPaymentMethod | null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const nfce_url = String(formData.get("nfce_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const confirm_duplicate = formData.get("confirm_duplicate") === "true";

  if (payment_method === "a_prazo" && !due_date) {
    return { error: "Informe o vencimento — compra/despesa a prazo precisa de uma data de vencimento." };
  }

  let items: ExpenseItemInput[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "Itens inválidos." };
  }

  const total_amount =
    items.length > 0
      ? items.reduce((sum, i) => sum + Number(i.subtotal || 0), 0)
      : Number(formData.get("total_amount") ?? 0);

  return {
    fields: { date, competence_date, document_number, supplier_id, payment_method, due_date, nfce_url, notes, total_amount, items, confirm_duplicate },
  };
}

// Cria uma despesa (com ou sem linhas de item, com ou sem foto de
// recibo). Se algum item tiver cost_item_id (ligado a estoque), a entrada
// de estoque correspondente é gerada sozinha por um trigger no banco (ver
// create_movement_from_expense_item em schema.sql) — esta action só
// grava a despesa e as linhas, mais o lançamento contábil automático
// (Módulo Contábil Leva 2), nunca mexe em inventory_movements diretamente.
export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const parsed = parseExpenseFormData(formData);
  if (parsed.error || !parsed.fields) return { error: parsed.error ?? "Dados inválidos." };
  const f = parsed.fields;
  const receipt = formData.get("receipt");

  if (!f.confirm_duplicate) {
    const isDuplicate = await findLikelyDuplicate(supabase, f.supplier_id, f.document_number, f.date, f.total_amount);
    if (isDuplicate) return { duplicateWarning: true, error: "Já existe uma despesa com o mesmo fornecedor, número do documento, data e valor. Tem certeza que quer lançar de novo?" };
  }

  const payment_status: ExpensePaymentStatus = f.payment_method === "a_prazo" ? "pendente" : "pago";
  const paid_at = payment_status === "pago" ? new Date().toISOString() : null;

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      date: f.date,
      competence_date: f.competence_date,
      document_number: f.document_number,
      supplier_id: f.supplier_id,
      total_amount: f.total_amount,
      payment_method: f.payment_method,
      payment_status,
      due_date: f.due_date,
      paid_at,
      nfce_url: f.nfce_url,
      notes: f.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !expense) return { error: error?.message ?? "Erro ao criar despesa." };

  let resolvedRows: ResolvedExpenseRow[] = [];
  if (f.items.length > 0) {
    const resolved = await resolveExpenseItemsForInsert(supabase, f.items, f.date, f.supplier_id, user.id);
    if (resolved.error || !resolved.rows) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: resolved.error ?? "Erro ao resolver os itens da despesa." };
    }
    resolvedRows = resolved.rows;

    const { error: itemsError } = await supabase
      .from("expense_items")
      .insert(resolvedRows.map((r) => ({ ...r, expense_id: expense.id })));
    if (itemsError) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: itemsError.message };
    }
  }

  const ledgerResult = await postExpenseLedgerEntry(
    supabase,
    expense.id,
    ledgerDescription(f, resolvedRows),
    f.competence_date,
    f.date,
    payment_status,
    f.payment_method,
    f.supplier_id,
    f.total_amount,
    resolvedRows
  );

  if (receipt instanceof File && receipt.size > 0) {
    try {
      const path = await uploadExpenseReceipt(expense.id, receipt);
      await supabase.from("expenses").update({ receipt_storage_path: path }).eq("id", expense.id);
    } catch (e) {
      return { success: true, expenseId: expense.id as string, photoError: (e as Error).message };
    }
  }

  revalidateAll();
  return { success: true, expenseId: expense.id as string, ledgerWarning: ledgerResult.error };
}

// Edita uma despesa já lançada (admin only). As linhas de item são sempre
// apagadas e recriadas do zero (nunca "diffadas") — como
// inventory_movements.reference_expense_item_id tem `on delete cascade`,
// apagar as linhas antigas já desfaz sozinho a entrada de estoque
// original, e recriá-las gera uma entrada nova com a quantidade
// corrigida, via o mesmo trigger de sempre. O lançamento contábil
// automático antigo é estornado e um novo é criado — nunca editado
// (mesma regra de nunca apagar um lançamento confirmado).
export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const parsed = parseExpenseFormData(formData);
  if (parsed.error || !parsed.fields) return { error: parsed.error ?? "Dados inválidos." };
  const f = parsed.fields;
  const receipt = formData.get("receipt");

  if (!f.confirm_duplicate) {
    const isDuplicate = await findLikelyDuplicate(supabase, f.supplier_id, f.document_number, f.date, f.total_amount, id);
    if (isDuplicate) return { duplicateWarning: true, error: "Já existe outra despesa com o mesmo fornecedor, número do documento, data e valor. Tem certeza que quer salvar assim mesmo?" };
  }

  const { data: current } = await supabase.from("expenses").select("payment_status, paid_at").eq("id", id).maybeSingle();
  // Edição não muda se já estava paga: só "Registrar pagamento" (ver
  // payExpense) liquida uma despesa pendente. Editar uma despesa já
  // paga continua paga; editar uma pendente continua pendente (a menos
  // que a forma de pagamento informada agora não seja mais "a prazo").
  const payment_status: ExpensePaymentStatus =
    current?.payment_status === "pago" ? "pago" : f.payment_method === "a_prazo" ? "pendente" : "pago";
  const paid_at = payment_status === "pago" ? (current?.paid_at ?? new Date().toISOString()) : null;

  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      date: f.date,
      competence_date: f.competence_date,
      document_number: f.document_number,
      supplier_id: f.supplier_id,
      total_amount: f.total_amount,
      payment_method: f.payment_method,
      payment_status,
      due_date: f.due_date,
      paid_at,
      nfce_url: f.nfce_url,
      notes: f.notes,
    })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  const { error: deleteItemsError } = await supabase.from("expense_items").delete().eq("expense_id", id);
  if (deleteItemsError) return { error: deleteItemsError.message };

  let resolvedRows: ResolvedExpenseRow[] = [];
  if (f.items.length > 0) {
    const resolved = await resolveExpenseItemsForInsert(supabase, f.items, f.date, f.supplier_id, user?.id ?? null);
    if (resolved.error || !resolved.rows) return { error: resolved.error ?? "Erro ao resolver os itens da despesa." };
    resolvedRows = resolved.rows;

    const { error: itemsError } = await supabase
      .from("expense_items")
      .insert(resolvedRows.map((r) => ({ ...r, expense_id: id })));
    if (itemsError) return { error: itemsError.message };
  }

  // Estorna o lançamento de RECONHECIMENTO antigo (origin='despesa' —
  // nunca o de pagamento, que é outro lançamento à parte com o mesmo
  // source_id) e cria um novo no lugar — nunca edita um lançamento
  // confirmado. Filtrar por origin aqui é essencial: uma despesa já paga
  // tem 2 lançamentos confirmados com o mesmo source_id (o de
  // reconhecimento E o de pagamento) — sem o filtro, a busca "única"
  // encontra 2 linhas e silenciosamente não acha nenhuma (mesma
  // categoria de bug já registrada no projeto: nunca assumir que uma
  // busca por "a" linha vai mesmo achar só 1).
  const { data: oldEntry } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("source_type", "expenses")
    .eq("source_id", id)
    .eq("origin", "despesa")
    .eq("status", "confirmado")
    .maybeSingle();
  if (oldEntry) {
    await supabase.rpc("reverse_ledger_entry", { p_entry_id: oldEntry.id, p_reason: "Despesa editada — lançamento refeito." });
  }

  // Se já existe um lançamento de PAGAMENTO confirmado pra esta despesa,
  // o caixa/banco já foi debitado naquele evento — o novo lançamento de
  // reconhecimento precisa continuar passando pela conta de "a pagar"
  // (nunca creditar caixa/banco de novo directly), senão a edição
  // duplicaria a saída de caixa. Só quando NÃO há pagamento separado
  // (despesa paga à vista desde a criação, nunca passou por
  // "a prazo"/payExpense) é que o reconhecimento pode creditar caixa/
  // banco direto, exatamente como na criação.
  const { data: existingPaymentEntry } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("source_type", "expenses")
    .eq("source_id", id)
    .eq("origin", "pagamento")
    .eq("status", "confirmado")
    .maybeSingle();
  const ledgerPaymentStatus: ExpensePaymentStatus = existingPaymentEntry ? "pendente" : payment_status;

  const ledgerResult = await postExpenseLedgerEntry(
    supabase,
    id,
    ledgerDescription(f, resolvedRows),
    f.competence_date,
    f.date,
    ledgerPaymentStatus,
    f.payment_method,
    f.supplier_id,
    f.total_amount,
    resolvedRows
  );

  if (receipt instanceof File && receipt.size > 0) {
    try {
      const path = await uploadExpenseReceipt(id, receipt);
      await supabase.from("expenses").update({ receipt_storage_path: path }).eq("id", id);
    } catch (e) {
      return { success: true, photoError: (e as Error).message };
    }
  }

  revalidateAll();
  return { success: true, ledgerWarning: ledgerResult.error };
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  // Uma despesa já paga tem 2 lançamentos confirmados (reconhecimento +
  // pagamento) — os dois precisam ser estornados ao excluir, não só "um"
  // (nunca usar .maybeSingle() aqui: encontraria 2 linhas e retornaria
  // null silenciosamente, pulando o estorno inteiro).
  const { data: entries } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("source_type", "expenses")
    .eq("source_id", id)
    .eq("status", "confirmado");
  for (const entry of entries ?? []) {
    await supabase.rpc("reverse_ledger_entry", { p_entry_id: entry.id, p_reason: "Despesa excluída." });
  }
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// Registra o pagamento de uma despesa "a prazo" (payment_status
// pendente) — só liquida a obrigação já reconhecida, nunca reconhece a
// despesa/estoque de novo (ver PRD_compras&contabil.md seção 4.1/6.6).
export async function payExpense(id: string, paymentMethod: SupplierPaymentMethod) {
  if (paymentMethod === "a_prazo") return { error: "Selecione uma forma de pagamento de verdade pra liquidar." };
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("payment_status, total_amount, supplier_id, notes, date")
    .eq("id", id)
    .maybeSingle();
  if (!expense) return { error: "Despesa não encontrada." };
  if (expense.payment_status !== "pendente") return { error: "Esta despesa já está paga." };

  const { error: updateError } = await supabase
    .from("expenses")
    .update({ payment_status: "pago", paid_at: new Date().toISOString(), payment_method: paymentMethod })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  const payableAccount = expense.supplier_id ? "fornecedores-a-pagar" : "despesas-a-pagar";
  const creditAccount = paymentMethod === "dinheiro" ? "caixa" : "banco";
  const today = toDateKey(nowInBrazil());
  const result = await postLedgerEntry(
    today,
    today,
    today,
    `Pagamento: ${expense.notes?.trim() || "despesa de " + expense.date}`,
    "pagamento",
    "expenses",
    id,
    [
      { account_code: payableAccount, cost_center_id: null, direction: "debito", amount: Number(expense.total_amount) },
      { account_code: creditAccount, cost_center_id: null, direction: "credito", amount: Number(expense.total_amount) },
    ]
  );
  if (result.error) return { success: true, ledgerWarning: result.error };

  revalidateAll();
  return { success: true };
}

export interface ExpenseWithItems {
  id: string;
  date: string;
  competence_date: string;
  document_number: string | null;
  supplier_id: string | null;
  payment_method: SupplierPaymentMethod | null;
  payment_status: ExpensePaymentStatus;
  due_date: string | null;
  nfce_url: string | null;
  notes: string | null;
  total_amount: number;
  receipt_url: string | null;
  items: {
    description: string;
    quantity: number;
    unit_cost: number;
    subtotal: number;
    discount: number;
    freight_and_other_costs: number;
    recoverable_tax: number;
    non_recoverable_tax: number;
    cost_item_id: string | null;
    fixed_asset_id: string | null;
    fixed_asset_name: string | null;
    purchase_quantity: number | null;
    purchase_unit: string | null;
    purchase_unit_cost: number | null;
    expiry_date: string | null;
    for_breakfast: boolean;
    center_split: { center_id: string; alloc_pct: number }[] | null;
  }[];
}

export async function getExpenseWithItems(id: string): Promise<ExpenseWithItems | null> {
  const supabase = await createClient();
  const { data: expense } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  if (!expense) return null;

  const { data: items } = await supabase
    .from("expense_items")
    .select(
      "description, quantity, unit_cost, subtotal, discount, freight_and_other_costs, recoverable_tax, non_recoverable_tax, cost_item_id, fixed_asset_id, purchase_quantity, purchase_unit, purchase_unit_cost, expiry_date, for_breakfast, center_split, fixed_assets(name)"
    )
    .eq("expense_id", id)
    .order("created_at");

  type Raw = {
    description: string;
    quantity: number;
    unit_cost: number;
    subtotal: number;
    discount: number;
    freight_and_other_costs: number;
    recoverable_tax: number;
    non_recoverable_tax: number;
    cost_item_id: string | null;
    fixed_asset_id: string | null;
    fixed_assets: { name: string } | null;
    purchase_quantity: number | null;
    purchase_unit: string | null;
    purchase_unit_cost: number | null;
    expiry_date: string | null;
    for_breakfast: boolean;
    center_split: { center_id: string; alloc_pct: number }[] | null;
  };

  return {
    id: expense.id,
    date: expense.date,
    competence_date: expense.competence_date,
    document_number: expense.document_number,
    supplier_id: expense.supplier_id,
    payment_method: expense.payment_method,
    payment_status: expense.payment_status,
    due_date: expense.due_date,
    nfce_url: expense.nfce_url,
    notes: expense.notes,
    total_amount: Number(expense.total_amount),
    receipt_url: expense.receipt_storage_path ? await signExpenseReceiptUrl(expense.receipt_storage_path) : null,
    items: ((items ?? []) as unknown as Raw[]).map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.subtotal,
      discount: Number(i.discount),
      freight_and_other_costs: Number(i.freight_and_other_costs),
      recoverable_tax: Number(i.recoverable_tax),
      non_recoverable_tax: Number(i.non_recoverable_tax),
      cost_item_id: i.cost_item_id,
      fixed_asset_id: i.fixed_asset_id,
      fixed_asset_name: i.fixed_assets?.name ?? null,
      purchase_quantity: i.purchase_quantity === null ? null : Number(i.purchase_quantity),
      purchase_unit: i.purchase_unit,
      purchase_unit_cost: i.purchase_unit_cost === null ? null : Number(i.purchase_unit_cost),
      expiry_date: i.expiry_date,
      for_breakfast: !!i.for_breakfast,
      center_split: i.center_split ?? null,
    })),
  };
}

// Nomes dos CENTROS de custo a que as linhas de uma despesa pertencem
// (via item de custo → centro) — pra exibição no Histórico. "Ativo
// permanente" cobre linhas de bem permanente; "Sem item" cobre despesa
// sem nenhuma linha (valor total só).
async function getCenterNamesByExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (expenseIds.length === 0) return result;

  const { data } = await supabase
    .from("expense_items")
    .select("expense_id, cost_item_id, fixed_asset_id")
    .in("expense_id", expenseIds);
  type Raw = { expense_id: string; cost_item_id: string | null; fixed_asset_id: string | null };
  const rows = (data ?? []) as unknown as Raw[];
  const costItemIds = [...new Set(rows.filter((r) => r.cost_item_id).map((r) => r.cost_item_id as string))];

  const { data: links } = costItemIds.length
    ? await supabase.from("cost_item_centers").select("cost_item_id, cost_centers(name)").in("cost_item_id", costItemIds)
    : { data: [] };
  type LinkRaw = { cost_item_id: string; cost_centers: { name: string } | null };
  const centersByCostItem = new Map<string, Set<string>>();
  ((links ?? []) as unknown as LinkRaw[]).forEach((l) => {
    const set = centersByCostItem.get(l.cost_item_id) ?? new Set<string>();
    if (l.cost_centers?.name) set.add(l.cost_centers.name);
    centersByCostItem.set(l.cost_item_id, set);
  });

  const setsByExpense = new Map<string, Set<string>>();
  rows.forEach((r) => {
    const set = setsByExpense.get(r.expense_id) ?? new Set<string>();
    if (r.fixed_asset_id) set.add("Ativo permanente");
    if (r.cost_item_id) (centersByCostItem.get(r.cost_item_id) ?? []).forEach((n) => set.add(n));
    setsByExpense.set(r.expense_id, set);
  });
  setsByExpense.forEach((set, expenseId) => result.set(expenseId, Array.from(set)));
  return result;
}

export interface ExpenseListRow {
  id: string;
  date: string;
  competence_date: string;
  document_number: string | null;
  category_name: string;
  supplier_name: string | null;
  total_amount: number;
  payment_method: SupplierPaymentMethod | null;
  payment_status: ExpensePaymentStatus;
  due_date: string | null;
  receipt_url: string | null;
  nfce_url: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export async function getExpenses(from: string, to: string): Promise<ExpenseListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select(
      "id, date, competence_date, document_number, total_amount, payment_method, payment_status, due_date, receipt_storage_path, nfce_url, notes, created_at, suppliers(name), created_by_profile:profiles(name)"
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  type Raw = {
    id: string;
    date: string;
    competence_date: string;
    document_number: string | null;
    total_amount: number;
    payment_method: SupplierPaymentMethod | null;
    payment_status: ExpensePaymentStatus;
    due_date: string | null;
    receipt_storage_path: string | null;
    nfce_url: string | null;
    notes: string | null;
    created_at: string;
    suppliers: { name: string } | null;
    created_by_profile: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  const centerNamesByExpense = await getCenterNamesByExpense(supabase, rows.map((r) => r.id));

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      date: r.date,
      competence_date: r.competence_date,
      document_number: r.document_number,
      category_name: (centerNamesByExpense.get(r.id) ?? []).join(" / ") || "Sem categoria",
      supplier_name: r.suppliers?.name ?? null,
      total_amount: Number(r.total_amount),
      payment_method: r.payment_method,
      payment_status: r.payment_status,
      due_date: r.due_date,
      receipt_url: r.receipt_storage_path ? await signExpenseReceiptUrl(r.receipt_storage_path) : null,
      nfce_url: r.nfce_url,
      notes: r.notes,
      created_by_name: r.created_by_profile?.name ?? "—",
      created_at: r.created_at,
    }))
  );
}

// Despesas "a prazo" ainda não pagas — base da tela "Pagamentos e
// recebimentos".
export interface PendingExpenseRow {
  id: string;
  date: string;
  due_date: string | null;
  supplier_name: string | null;
  total_amount: number;
  notes: string | null;
}

export async function getPendingExpenses(): Promise<PendingExpenseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("id, date, due_date, total_amount, notes, suppliers(name)")
    .eq("payment_status", "pendente")
    .order("due_date", { ascending: true, nullsFirst: false });

  type Raw = { id: string; date: string; due_date: string | null; total_amount: number; notes: string | null; suppliers: { name: string } | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    date: r.date,
    due_date: r.due_date,
    supplier_name: r.suppliers?.name ?? null,
    total_amount: Number(r.total_amount),
    notes: r.notes,
  }));
}

export interface ExpenseSupplierSummaryRow {
  supplier_name: string;
  total: number;
}

export async function getExpenseSummaryBySupplier(from: string, to: string): Promise<ExpenseSupplierSummaryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("total_amount, suppliers(name)").gte("date", from).lte("date", to);

  type Raw = { total_amount: number; suppliers: { name: string } | null };
  const bySupplier = new Map<string, number>();
  ((data ?? []) as unknown as Raw[]).forEach((r) => {
    const name = r.suppliers?.name ?? "Sem fornecedor";
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + Number(r.total_amount));
  });

  return Array.from(bySupplier.entries())
    .map(([supplier_name, total]) => ({ supplier_name, total }))
    .sort((a, b) => b.total - a.total);
}

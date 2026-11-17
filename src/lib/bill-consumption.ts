import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateShortPt, formatTimePt, dateKeyInBrazil } from "@/lib/date";

// Tabelas de consumo de uma conta (matrizes: linhas = itens, colunas = quando foi lançado).
// Servem à tela "Consumo por suítes" e ao PDF da conta.

export interface ConsumptionColumn {
  key: string;
  title: string;
  subtitle?: string;
  kind: "prior" | "servico" | "adicional" | "comanda";
  taskId?: string;
  comandaId?: string;
}

export interface ConsumptionMatrix {
  columns: ConsumptionColumn[];
  rows: { name: string; cells: number[]; total: number }[];
}

// Antes de existir o registro por dia, o consumo de frigobar de uma conta não tinha data.
export const PRIOR_COLUMN_TITLE = "Até 14/11";

const EMPTY: ConsumptionMatrix = { columns: [], rows: [] };

type Group = { column: ConsumptionColumn; firstAt: string; byItem: Map<string, number> };

// Frigobar: uma coluna "Até 14/11" (o que veio antes do registro por dia), uma coluna por serviço
// (data do serviço) e uma por dia de lançamento adicional — tudo em ordem cronológica de lançamento.
export async function buildMinibarMatrices(billIds: string[]): Promise<Map<string, ConsumptionMatrix>> {
  const result = new Map<string, ConsumptionMatrix>();
  if (billIds.length === 0) return result;
  const admin = createAdminClient();

  const [{ data: current }, { data: launches }] = await Promise.all([
    admin.from("room_bill_minibar_items").select("bill_id, minibar_item_id, quantity, minibar_items(name)").in("bill_id", billIds),
    admin
      .from("minibar_launches")
      .select("bill_id, minibar_item_id, delta, source, task_id, created_at, launched_on")
      .in("bill_id", billIds)
      .order("created_at", { ascending: true })
      .limit(5000),
  ]);

  const names = new Map<string, string>();
  const currentQty = new Map<string, number>(); // `${bill}|${item}`
  ((current ?? []) as unknown as { bill_id: string; minibar_item_id: string; quantity: number; minibar_items: { name: string } | null }[]).forEach(
    (r) => {
      names.set(r.minibar_item_id, r.minibar_items?.name ?? "—");
      currentQty.set(`${r.bill_id}|${r.minibar_item_id}`, r.quantity);
    }
  );

  type Launch = { bill_id: string; minibar_item_id: string; delta: number; source: string | null; task_id: string | null; created_at: string; launched_on: string };
  const rows = (launches ?? []) as Launch[];
  const taskIds = Array.from(new Set(rows.map((l) => l.task_id).filter((v): v is string => !!v)));
  const { data: tasks } = taskIds.length
    ? await admin.from("daily_room_tasks").select("id, date").in("id", taskIds)
    : { data: [] as { id: string; date: string }[] };
  const taskDate = new Map((tasks ?? []).map((t) => [t.id as string, t.date as string]));

  for (const billId of billIds) {
    const groups = new Map<string, Group>();
    const datedTotals = new Map<string, number>(); // por item, tudo que tem coluna própria
    for (const l of rows.filter((x) => x.bill_id === billId && x.source)) {
      const isService = l.source === "servico" && l.task_id;
      const key = isService ? `s:${l.task_id}` : `a:${l.launched_on}`;
      let g = groups.get(key);
      if (!g) {
        g = isService
          ? {
              column: {
                key,
                title: formatDateShortPt(taskDate.get(l.task_id as string) ?? l.launched_on),
                subtitle: "serviço",
                kind: "servico",
                taskId: l.task_id as string,
              },
              firstAt: l.created_at,
              byItem: new Map(),
            }
          : {
              column: { key, title: formatDateShortPt(l.launched_on), subtitle: "lançamento adicional", kind: "adicional" },
              firstAt: l.created_at,
              byItem: new Map(),
            };
        groups.set(key, g);
      }
      g.byItem.set(l.minibar_item_id, (g.byItem.get(l.minibar_item_id) ?? 0) + l.delta);
      datedTotals.set(l.minibar_item_id, (datedTotals.get(l.minibar_item_id) ?? 0) + l.delta);
    }

    // Antes do registro por dia = quantidade atual da conta menos tudo que já tem coluna própria.
    const prior = new Map<string, number>();
    const itemIds = new Set<string>([...datedTotals.keys()]);
    currentQty.forEach((_, k) => {
      if (k.startsWith(billId + "|")) itemIds.add(k.split("|")[1]);
    });
    itemIds.forEach((itemId) => {
      const p = (currentQty.get(`${billId}|${itemId}`) ?? 0) - (datedTotals.get(itemId) ?? 0);
      if (p !== 0) prior.set(itemId, p);
    });

    const ordered = Array.from(groups.values())
      .filter((g) => Array.from(g.byItem.values()).some((v) => v !== 0))
      .sort((a, b) => a.firstAt.localeCompare(b.firstAt));

    const columns: ConsumptionColumn[] = [];
    const cols: Map<string, number>[] = [];
    if (prior.size > 0) {
      columns.push({ key: "prior", title: PRIOR_COLUMN_TITLE, kind: "prior" });
      cols.push(prior);
    }
    ordered.forEach((g) => {
      columns.push(g.column);
      cols.push(g.byItem);
    });

    const usedItems = Array.from(itemIds).filter((id) => cols.some((c) => (c.get(id) ?? 0) !== 0));
    usedItems.sort((a, b) => (names.get(a) ?? "").localeCompare(names.get(b) ?? ""));
    result.set(billId, {
      columns,
      rows: usedItems.map((id) => {
        const cells = cols.map((c) => c.get(id) ?? 0);
        return { name: names.get(id) ?? "—", cells, total: cells.reduce((s, v) => s + v, 0) };
      }),
    });
  }
  return result;
}

// Bar da piscina: uma coluna por comanda (número e data), em ordem de lançamento.
export async function buildBarMatrices(billIds: string[]): Promise<Map<string, ConsumptionMatrix>> {
  const result = new Map<string, ConsumptionMatrix>();
  if (billIds.length === 0) return result;
  const admin = createAdminClient();
  const { data } = await admin
    .from("bar_comandas")
    .select("id, bill_id, monthly_number, sequence_number, created_at, bar_comanda_items(quantity, poolbar_items(name))")
    .in("bill_id", billIds)
    .neq("status", "cancelada")
    .order("created_at", { ascending: true });

  type C = {
    id: string;
    bill_id: string;
    monthly_number: number | null;
    sequence_number: number;
    created_at: string;
    bar_comanda_items: { quantity: number; poolbar_items: { name: string } | null }[];
  };
  const comandas = (data ?? []) as unknown as C[];

  for (const billId of billIds) {
    const mine = comandas.filter((c) => c.bill_id === billId && c.bar_comanda_items.some((i) => i.quantity > 0));
    const columns: ConsumptionColumn[] = mine.map((c) => ({
      key: c.id,
      title: `#${c.monthly_number ?? c.sequence_number}`,
      subtitle: `${formatDateShortPt(dateKeyInBrazil(c.created_at))} ${formatTimePt(c.created_at)}`,
      kind: "comanda",
      comandaId: c.id,
    }));
    const names = new Set<string>();
    mine.forEach((c) => c.bar_comanda_items.forEach((i) => i.quantity > 0 && names.add(i.poolbar_items?.name ?? "—")));
    const rows = Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const cells = mine.map((c) =>
          c.bar_comanda_items.filter((i) => (i.poolbar_items?.name ?? "—") === name).reduce((s, i) => s + i.quantity, 0)
        );
        return { name, cells, total: cells.reduce((s, v) => s + v, 0) };
      });
    result.set(billId, { columns, rows });
  }
  return result;
}

export function emptyMatrix(): ConsumptionMatrix {
  return EMPTY;
}

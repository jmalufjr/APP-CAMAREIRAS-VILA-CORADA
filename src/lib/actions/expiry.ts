"use server";

import { createClient } from "@/lib/supabase/server";
import { todayKey, addDaysKey } from "@/lib/date";

export interface ExpiringLot {
  inventory_item_id: string;
  item_name: string;
  unit: string;
  purchase_date: string;
  expiry_date: string;
  // Quanto ainda resta desse lote (consumo atribuído ao lote que vence
  // primeiro — quem vence antes sai antes).
  remaining: number;
  days_left: number; // negativo = já venceu
  alert_days: number;
}

// Lotes com validade que ainda têm saldo e estão vencidos ou dentro do
// prazo de aviso do produto. O estoque não guarda lote físico: o saldo
// atual vs. o total comprado COM validade diz quanto já saiu, e esse
// consumo é atribuído sempre ao lote que vence primeiro (PRD 5.1 —
// "consumir primeiro o mais antigo"). Ignora o que foi comprado sem
// validade: não dá pra saber, então não alerta.
export async function getExpiringLots(): Promise<ExpiringLot[]> {
  const supabase = await createClient();
  const [{ data: lots }, { data: balances }] = await Promise.all([
    supabase
      .from("expense_items")
      .select("quantity, expiry_date, cost_items!inner(inventory_item_id, inventory_items(name, unit, expiry_alert_days)), expenses(date)")
      .not("expiry_date", "is", null),
    supabase.from("inventory_balances").select("inventory_item_id, balance"),
  ]);

  type Raw = {
    quantity: number;
    expiry_date: string;
    cost_items: {
      inventory_item_id: string | null;
      inventory_items: { name: string; unit: string; expiry_alert_days: number } | null;
    } | null;
    expenses: { date: string } | null;
  };

  const balanceByItem = new Map(((balances ?? []) as { inventory_item_id: string; balance: number }[]).map((b) => [b.inventory_item_id, Number(b.balance)]));
  const byItem = new Map<string, { raw: Raw; qty: number }[]>();
  ((lots ?? []) as unknown as Raw[]).forEach((r) => {
    const id = r.cost_items?.inventory_item_id;
    if (!id || !r.cost_items?.inventory_items) return;
    const list = byItem.get(id) ?? [];
    list.push({ raw: r, qty: Number(r.quantity) });
    byItem.set(id, list);
  });

  const today = todayKey();
  const result: ExpiringLot[] = [];
  byItem.forEach((list, itemId) => {
    list.sort((a, b) => a.raw.expiry_date.localeCompare(b.raw.expiry_date));
    const totalLots = list.reduce((s, l) => s + l.qty, 0);
    let consumed = Math.max(0, totalLots - (balanceByItem.get(itemId) ?? 0));
    for (const l of list) {
      const used = Math.min(consumed, l.qty);
      consumed -= used;
      const remaining = l.qty - used;
      if (remaining <= 0.0005) continue;
      const inv = l.raw.cost_items!.inventory_items!;
      const limit = addDaysKey(today, inv.expiry_alert_days);
      if (l.raw.expiry_date > limit) continue;
      const days = Math.round((Date.parse(l.raw.expiry_date) - Date.parse(today)) / 86400000);
      result.push({
        inventory_item_id: itemId,
        item_name: inv.name,
        unit: inv.unit,
        purchase_date: l.raw.expenses?.date ?? "",
        expiry_date: l.raw.expiry_date,
        remaining: Math.round(remaining * 1000) / 1000,
        days_left: days,
        alert_days: inv.expiry_alert_days,
      });
    }
  });
  return result.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/authz";
import { nextDayBrasiliaUtcBoundary, startOfDayBrasiliaUtc } from "@/lib/date";
import { distributeByDays, splitIngredientCostAmongProducts } from "@/lib/expense-allocation";
import type { BarProductRecipe, ProductCostReport, ProductCostRow } from "@/lib/product-cost-types";

type Result = { error?: string; success?: boolean };
const ROLES = ["admin", "gerente_operacional"] as const;
const round2 = (v: number) => Math.round(v * 100) / 100;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

// ---------- Ficha técnica ----------

export async function getBarProductRecipes(): Promise<BarProductRecipe[]> {
  const denied = await requireRole([...ROLES]);
  if (denied) return [];
  const supabase = await createClient();
  const { data: items } = await supabase.from("poolbar_items").select("id, name, category").order("category").order("name");
  const { data: rows } = await supabase
    .from("bar_product_ingredients")
    .select("poolbar_item_id, ingredient_id, quantity, ingredients(name)");

  return (items ?? []).map((it) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    ingredients: (rows ?? [])
      .filter((r) => r.poolbar_item_id === it.id)
      .map((r) => ({
        ingredient_id: r.ingredient_id,
        ingredient_name: one(r.ingredients as { name: string } | { name: string }[] | null)?.name ?? "—",
        quantity: Number(r.quantity),
      })),
  }));
}

export async function saveBarProductRecipe(
  poolbarItemId: string,
  ingredients: { ingredientId: string; quantity: number }[]
): Promise<Result> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  const clean = ingredients.filter((i) => i.ingredientId);
  if (clean.some((i) => !(i.quantity > 0))) return { error: "Informe a quantidade de cada ingrediente (maior que zero)." };
  if (new Set(clean.map((i) => i.ingredientId)).size !== clean.length) return { error: "Há um ingrediente repetido." };

  const supabase = await createClient();
  const { error: delErr } = await supabase.from("bar_product_ingredients").delete().eq("poolbar_item_id", poolbarItemId);
  if (delErr) return { error: delErr.message };
  if (clean.length > 0) {
    const { error } = await supabase
      .from("bar_product_ingredients")
      .insert(clean.map((i) => ({ poolbar_item_id: poolbarItemId, ingredient_id: i.ingredientId, quantity: i.quantity })));
    if (error) return { error: error.message };
  }
  revalidatePath("/contabil", "layout");
  return { success: true };
}

// ---------- Custo e rentabilidade mensal por produto (estimativa) ----------

export async function getProductCostReport(month: string): Promise<ProductCostReport | { error: string }> {
  const denied = await requireRole([...ROLES]);
  if (denied) return { error: denied.error };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };

  const supabase = await createClient();
  const [y, m] = month.split("-").map(Number);
  const last = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const first = `${month}-01`;

  const [{ data: items }, { data: recipes }, { data: ingredients }, { data: settings }] = await Promise.all([
    supabase.from("poolbar_items").select("id, name, category"),
    supabase.from("bar_product_ingredients").select("poolbar_item_id, ingredient_id, quantity"),
    supabase.from("ingredients").select("id, bar_pct"),
    supabase.from("expense_settings").select("start_date").eq("id", true).single(),
  ]);
  const startDate = settings?.start_date ?? "2026-11-01";

  // Vendas do mês (comandas lançadas no mês, sem canceladas).
  const { data: comandas } = await supabase
    .from("bar_comandas")
    .select("bar_comanda_items(poolbar_item_id, quantity, price_snapshot)")
    .gte("created_at", startOfDayBrasiliaUtc(first))
    .lt("created_at", nextDayBrasiliaUtcBoundary(last))
    .neq("status", "cancelada");

  const sold: Record<string, { qty: number; revenue: number }> = {};
  for (const c of comandas ?? []) {
    for (const it of (c.bar_comanda_items ?? []) as { poolbar_item_id: string; quantity: number; price_snapshot: number | string }[]) {
      const cur = (sold[it.poolbar_item_id] ??= { qty: 0, revenue: 0 });
      cur.qty += it.quantity;
      cur.revenue += it.quantity * Number(it.price_snapshot);
    }
  }

  // Custo do mês de cada ingrediente (parte do Bar), com o mesmo rateio no tempo do resultado.
  const barPct = new Map((ingredients ?? []).map((i) => [i.id as string, Number(i.bar_pct)]));
  const { data: lines } = await supabase
    .from("purchase_lines")
    .select("ingredient_id, amount, expense_categories(consumption_days), purchases!inner(date, status)")
    .not("ingredient_id", "is", null)
    .eq("is_asset", false)
    .eq("purchases.status", "registrada")
    .gte("purchases.date", startDate)
    .lte("purchases.date", last);

  const ingredientCost: Record<string, number> = {};
  for (const l of (lines ?? []) as unknown as {
    ingredient_id: string;
    amount: number | string;
    expense_categories: { consumption_days: number } | { consumption_days: number }[] | null;
    purchases: { date: string } | { date: string }[];
  }[]) {
    const days = one(l.expense_categories)?.consumption_days ?? 1;
    const portion = distributeByDays(one(l.purchases)!.date, Number(l.amount), days)[month] ?? 0;
    const bar = (portion * (barPct.get(l.ingredient_id) ?? 0)) / 100;
    if (bar > 0) ingredientCost[l.ingredient_id] = (ingredientCost[l.ingredient_id] ?? 0) + bar;
  }

  const products = (items ?? []).map((it) => ({
    id: it.id as string,
    sold: sold[it.id]?.qty ?? 0,
    ingredients: (recipes ?? [])
      .filter((r) => r.poolbar_item_id === it.id)
      .map((r) => ({ ingredientId: r.ingredient_id as string, quantity: Number(r.quantity) })),
  }));
  const { costByProduct, unassigned } = splitIngredientCostAmongProducts(products, ingredientCost);

  const rows: ProductCostRow[] = (items ?? [])
    .map((it) => {
      const s = sold[it.id] ?? { qty: 0, revenue: 0 };
      const cost = round2(costByProduct[it.id] ?? 0);
      const revenue = round2(s.revenue);
      return {
        id: it.id as string,
        name: it.name as string,
        category: it.category as string | null,
        sold: s.qty,
        revenue,
        cost,
        avgCost: s.qty > 0 ? round2(cost / s.qty) : null,
        profit: round2(revenue - cost),
        marginPct: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null,
        hasRecipe: (recipes ?? []).some((r) => r.poolbar_item_id === it.id),
      };
    })
    .filter((r) => r.sold > 0 || r.cost > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    month,
    rows,
    unassignedCost: round2(unassigned),
    totalIngredientBarCost: round2(Object.values(ingredientCost).reduce((s, v) => s + v, 0)),
  };
}

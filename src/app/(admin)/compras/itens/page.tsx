import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getInventoryItems, getAllInventoryItemRecipesGrouped } from "@/lib/actions/inventory-items";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { getInventoryTurnoverGroups } from "@/lib/actions/inventory-turnover-groups";
import { InventoryItemsPanel } from "./inventory-items-panel";
import type { MinibarItem, PoolbarItem } from "@/lib/types";

export default async function ItensEstoquePage() {
  const supabase = await createClient();
  const [items, categories, turnoverGroups, recipesByItem, { data: minibarItems }, { data: poolbarItems }] =
    await Promise.all([
      getInventoryItems(false),
      getExpenseCategories(),
      getInventoryTurnoverGroups(),
      getAllInventoryItemRecipesGrouped(),
      supabase.from("minibar_items").select("*").order("position"),
      supabase.from("poolbar_items").select("*").order("position"),
    ]);

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader
        title="Itens de estoque"
        subtitle="Catálogo de produtos controlados por estoque — limpeza, piscina, jardim, manutenção, café e bar."
      />
      <InventoryItemsPanel
        items={items}
        categories={categories.filter((c) => c.active && c.is_inventory_category)}
        turnoverGroups={turnoverGroups}
        recipesByItem={recipesByItem}
        minibarItems={(minibarItems ?? []) as MinibarItem[]}
        poolbarItems={(poolbarItems ?? []) as PoolbarItem[]}
      />
    </div>
  );
}

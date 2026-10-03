"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InventoryItemWithBalance, InventoryItemRecipeView } from "@/lib/actions/inventory-items";
import { deleteInventoryItem } from "@/lib/actions/inventory-items";
import type { ExpenseCategory, InventoryTurnoverGroup, MinibarItem, PoolbarItem } from "@/lib/types";
import { InventoryItemFormDialog } from "./inventory-item-form-dialog";
import { InventoryItemRecipesSection } from "./inventory-item-recipes-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

export function InventoryItemsPanel({
  items,
  categories,
  turnoverGroups,
  recipesByItem,
  minibarItems,
  poolbarItems,
}: {
  items: InventoryItemWithBalance[];
  categories: ExpenseCategory[];
  turnoverGroups: InventoryTurnoverGroup[];
  recipesByItem: Record<string, InventoryItemRecipeView[]>;
  minibarItems: MinibarItem[];
  poolbarItems: PoolbarItem[];
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-4">
      <InventoryItemFormDialog categories={categories} turnoverGroups={turnoverGroups} />

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.category_names.join(" / ") || "sem categoria"} · {item.unit}
                  {item.barcode ? ` · cód. ${item.barcode}` : ""}
                  {item.turnover_group_name ? ` · giro: ${item.turnover_group_name}` : " · sem grupo de giro"}
                  {item.portion_weight_kg ? ` · ${item.portion_weight_kg} kg/porção` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.reorder_point > 0 && item.balance < item.reorder_point ? "destructive" : "secondary"}>
                  Saldo: {item.balance} {item.unit}
                </Badge>
                <InventoryItemFormDialog item={item} categories={categories} turnoverGroups={turnoverGroups} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!confirm(`Excluir item ${item.name}?`)) return;
                    startTransition(async () => {
                      const result = await deleteInventoryItem(item.id);
                      if (result?.error) toast.error(result.error);
                      else router.refresh();
                    });
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>

            <InventoryItemRecipesSection
              inventoryItemId={item.id}
              itemUnit={item.unit}
              recipes={recipesByItem[item.id] ?? []}
              minibarItems={minibarItems}
              poolbarItems={poolbarItems}
            />
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum item de estoque cadastrado.</p>}
      </div>
    </div>
  );
}

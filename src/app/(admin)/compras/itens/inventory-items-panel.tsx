"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InventoryItemWithBalance } from "@/lib/actions/inventory-items";
import { deleteInventoryItem, linkInventoryItemToCatalog } from "@/lib/actions/inventory-items";
import type { ExpenseCategory, MinibarItem, PoolbarItem } from "@/lib/types";
import { InventoryItemFormDialog } from "./inventory-item-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

function linkKey(item: InventoryItemWithBalance): string {
  if (item.linked_minibar_item_id) return `minibar:${item.linked_minibar_item_id}`;
  if (item.linked_poolbar_item_id) return `poolbar:${item.linked_poolbar_item_id}`;
  return "none";
}

export function InventoryItemsPanel({
  items,
  categories,
  minibarItems,
  poolbarItems,
}: {
  items: InventoryItemWithBalance[];
  categories: ExpenseCategory[];
  minibarItems: MinibarItem[];
  poolbarItems: PoolbarItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function linkLabel(key: string): string {
    if (key === "none") return "Baixa automática: nenhuma";
    const [kind, id] = key.split(":");
    if (kind === "minibar") return `Frigobar: ${minibarItems.find((i) => i.id === id)?.name ?? "—"}`;
    return `Bar da piscina: ${poolbarItems.find((i) => i.id === id)?.name ?? "—"}`;
  }

  function handleLinkChange(itemId: string, value: string) {
    startTransition(async () => {
      let result;
      if (value === "none") result = await linkInventoryItemToCatalog(itemId, "none", null);
      else {
        const [kind, id] = value.split(":");
        result = await linkInventoryItemToCatalog(itemId, kind as "minibar" | "poolbar", id);
      }
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <InventoryItemFormDialog categories={categories} />

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.category_name} · {item.unit}
                  {item.barcode ? ` · cód. ${item.barcode}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.reorder_point > 0 && item.balance < item.reorder_point ? "destructive" : "secondary"}>
                  Saldo: {item.balance} {item.unit}
                </Badge>
                <InventoryItemFormDialog item={item} categories={categories} />
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

            <div className="max-w-sm space-y-1">
              <p className="text-xs text-muted-foreground">
                Baixa automática do estoque quando um hóspede paga a conta com este item consumido:
              </p>
              <Select
                value={linkKey(item)}
                onValueChange={(v) => v && handleLinkChange(item.id, v)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhuma">{(v: string) => linkLabel(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {minibarItems.map((m) => (
                    <SelectItem key={`minibar:${m.id}`} value={`minibar:${m.id}`}>
                      Frigobar: {m.name}
                    </SelectItem>
                  ))}
                  {poolbarItems.map((p) => (
                    <SelectItem key={`poolbar:${p.id}`} value={`poolbar:${p.id}`}>
                      Bar da piscina: {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum item de estoque cadastrado.</p>}
      </div>
    </div>
  );
}

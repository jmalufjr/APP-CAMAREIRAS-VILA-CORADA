"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InventoryItemRecipeView } from "@/lib/actions/inventory-items";
import { addInventoryItemRecipe, removeInventoryItemRecipe } from "@/lib/actions/inventory-items";
import type { MinibarItem, PoolbarItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

// Ficha técnica: quais produtos do cardápio (frigobar OU bar da piscina)
// consomem este ingrediente, e quantas porções por pedido — substitui o
// vínculo simples 1-pra-1 de antes, permitindo um ingrediente (ex.:
// macaxeira) alimentar vários pratos ao mesmo tempo (ver PRD_compras.md).
export function InventoryItemRecipesSection({
  inventoryItemId,
  recipes,
  minibarItems,
  poolbarItems,
}: {
  inventoryItemId: string;
  recipes: InventoryItemRecipeView[];
  minibarItems: MinibarItem[];
  poolbarItems: PoolbarItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [kind, setKind] = useState<"minibar" | "poolbar">("poolbar");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [portions, setPortions] = useState("1");

  const catalogOptions = kind === "minibar" ? minibarItems : poolbarItems;
  const alreadyLinkedIds = new Set(
    recipes.filter((r) => r.catalog_kind === kind).map((r) => (kind === "minibar" ? r.minibar_item_id : r.poolbar_item_id))
  );
  const availableOptions = catalogOptions.filter((o) => !alreadyLinkedIds.has(o.id));

  function handleAdd() {
    const portionsNum = Number(portions);
    startTransition(async () => {
      const result = await addInventoryItemRecipe(inventoryItemId, kind, catalogItemId, portionsNum);
      if (result?.error) toast.error(result.error);
      else {
        setCatalogItemId("");
        setPortions("1");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Produtos do cardápio que consomem este ingrediente (baixa automática ao pagar a conta):
      </p>
      {recipes.length > 0 && (
        <div className="space-y-1.5">
          {recipes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
              <span>
                {r.catalog_kind === "minibar" ? "Frigobar" : "Bar da piscina"}: {r.catalog_name} ·{" "}
                {r.portions_per_order} porção(ões)/pedido
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await removeInventoryItemRecipe(r.id);
                    if (result?.error) toast.error(result.error);
                    else router.refresh();
                  });
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Select value={kind} onValueChange={(v) => { setKind((v as "minibar" | "poolbar") ?? "poolbar"); setCatalogItemId(""); }}>
          <SelectTrigger className="w-36">
            <SelectValue>{(v: string) => (v === "minibar" ? "Frigobar" : "Bar da piscina")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="poolbar">Bar da piscina</SelectItem>
            <SelectItem value="minibar">Frigobar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={catalogItemId} onValueChange={(v) => setCatalogItemId(v ?? "")}>
          <SelectTrigger className="min-w-48 flex-1">
            <SelectValue placeholder="Produto do cardápio">
              {(v: string) => catalogOptions.find((o) => o.id === v)?.name ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0.001}
          step="0.001"
          className="w-24"
          value={portions}
          onChange={(e) => setPortions(e.target.value)}
          placeholder="Porções"
        />
        <Button size="sm" disabled={isPending || !catalogItemId} onClick={handleAdd}>
          Ligar
        </Button>
      </div>
    </div>
  );
}

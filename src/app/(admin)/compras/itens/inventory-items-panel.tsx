"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InventoryItemWithCostPlan } from "@/lib/actions/inventory-cost-view";
import { updateInventoryItemCoverageDays } from "@/lib/actions/inventory-items";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Badge } from "@/components/ui/badge";

// Agrupado por centro de custo, pra ficar fácil de navegar mesmo com
// muitos itens — a identidade/categoria vem do Plano de Contas, essa
// tela só mostra; "dias de folga" é o único campo editável aqui.
export function InventoryItemsPanel({ items }: { items: InventoryItemWithCostPlan[] }) {
  const grouped = new Map<string, InventoryItemWithCostPlan[]>();
  items.forEach((i) => {
    const key = i.center_names[0] ?? "Sem centro de custo";
    const list = grouped.get(key) ?? [];
    list.push(i);
    grouped.set(key, list);
  });

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([center, groupItems]) => (
        <div key={center} className="space-y-2">
          <h3 className="font-heading text-lg">{center}</h3>
          <div className="space-y-2">
            {groupItems.map((item) => (
              <ItemRow key={item.inventory_item_id} item={item} />
            ))}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          Nenhum item de estoque ainda — cadastre itens de custo marcados &quot;representa estoque&quot; no Plano de
          Contas.
        </p>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: InventoryItemWithCostPlan }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [coverageDays, setCoverageDays] = useState(item.coverage_days);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div>
        <p className="text-sm font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.subcenter_names.join(" / ") || "—"} · Saldo: {item.balance} {item.unit}
          {item.reorder_point > 0 ? ` · Ponto de reposição manual: ${item.reorder_point} ${item.unit}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Dias de folga</Badge>
        <QuantityStepper
          value={coverageDays}
          min={1}
          disabled={isPending}
          onChange={(v) => {
            setCoverageDays(v);
            startTransition(async () => {
              const result = await updateInventoryItemCoverageDays(item.inventory_item_id, v);
              if (result?.error) toast.error(result.error);
              else router.refresh();
            });
          }}
        />
      </div>
    </div>
  );
}

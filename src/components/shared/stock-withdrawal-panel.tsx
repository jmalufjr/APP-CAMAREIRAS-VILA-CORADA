"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InventoryItemWithBalance } from "@/lib/actions/inventory-items";
import { registerStockWithdrawal } from "@/lib/actions/inventory-movements";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { BarcodeScannerButton } from "@/components/shared/barcode-scanner";
import { Search } from "lucide-react";

// Tela de "dar baixa" num item de estoque — usada pela camareira, pelo
// funcionário de manutenção e pelo admin (único ponto em comum entre os
// três papéis no módulo de compras/estoque — ver PRD_compras.md seção
// 7.2). Busca por nome ou aponta a câmera pro código de barras do item.
export function StockWithdrawalPanel({ items }: { items: InventoryItemWithBalance[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryItemWithBalance | null>(null);
  const [quantity, setQuantity] = useState(1);

  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  function handleScan(barcode: string) {
    const match = items.find((i) => i.barcode === barcode);
    if (match) {
      setSelected(match);
      setSearch("");
    } else {
      toast.error("Nenhum item cadastrado com esse código de barras.");
    }
  }

  function handleConfirm() {
    if (!selected) return;
    startTransition(async () => {
      const result = await registerStockWithdrawal(selected.id, quantity);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`Baixa de ${quantity} ${selected.unit} de "${selected.name}" registrada.`);
        setSelected(null);
        setQuantity(1);
        router.refresh();
      }
    });
  }

  if (selected) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {selected.category_names.join(" / ") || "—"} · Saldo atual: {selected.balance} {selected.unit}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Quantidade a dar baixa ({selected.unit})</span>
            <QuantityStepper value={quantity} onChange={setQuantity} disabled={isPending} min={1} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Salvando..." : "Confirmar baixa"}
            </Button>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar item pelo nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <BarcodeScannerButton onScan={handleScan} label="Ler código de barras" />
      </div>

      <div className="space-y-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.category_names.join(" / ") || "—"}</p>
            </div>
            <Badge variant={item.reorder_point > 0 && item.balance < item.reorder_point ? "destructive" : "secondary"}>
              {item.balance} {item.unit}
            </Badge>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum item encontrado.</p>
        )}
      </div>
    </div>
  );
}

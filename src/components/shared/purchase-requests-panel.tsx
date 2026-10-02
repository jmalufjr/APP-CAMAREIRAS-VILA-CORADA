"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InventoryItemWithBalance } from "@/lib/actions/inventory-items";
import type { MyPurchaseRequestRow } from "@/lib/actions/purchase-requests";
import { createPurchaseRequest, updatePurchaseRequest, cancelPurchaseRequest } from "@/lib/actions/purchase-requests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Search, Pencil, X, Check } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  atendido: "Comprado",
  cancelado: "Cancelado",
};

// Pedido visual de compra — "isto está acabando" — usado pela camareira e
// pelo funcionário de manutenção. Cada pedido é uma linha própria: pedir
// o mesmo item de novo nunca mescla com um pedido já existente, os
// pendentes só se somam na tela do admin (ver PRD_compras.md).
export function PurchaseRequestsPanel({
  items,
  myRequests,
}: {
  items: InventoryItemWithBalance[];
  myRequests: MyPurchaseRequestRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryItemWithBalance | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState("");

  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  const pending = myRequests.filter((r) => r.status === "pendente");
  const resolved = myRequests.filter((r) => r.status !== "pendente").slice(0, 10);

  function handleSubmit() {
    if (!selected) return;
    startTransition(async () => {
      const result = await createPurchaseRequest(selected.id, quantity, notes);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Pedido de "${selected.name}" registrado.`);
      setSelected(null);
      setQuantity(1);
      setNotes("");
      setSearch("");
      router.refresh();
    });
  }

  function startEdit(r: MyPurchaseRequestRow) {
    setEditingId(r.id);
    setEditQty(r.requested_qty);
    setEditNotes(r.notes ?? "");
  }

  function saveEdit() {
    if (!editingId) return;
    startTransition(async () => {
      const result = await updatePurchaseRequest(editingId, editQty, editNotes);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Pedido atualizado.");
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Cancelar este pedido?")) return;
    startTransition(async () => {
      const result = await cancelPurchaseRequest(id);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-heading text-lg">Registrar o que está faltando</h3>
          {selected ? (
            <div className="space-y-3">
              <p className="font-medium">{selected.name}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Quantidade ({selected.unit})</span>
                <QuantityStepper value={quantity} onChange={setQuantity} disabled={isPending} min={1} />
              </div>
              <Textarea
                placeholder="Observação (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSubmit} disabled={isPending}>
                  {isPending ? "Enviando..." : "Registrar pedido"}
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)} disabled={isPending}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar item pelo nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category_name}</p>
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item encontrado.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-heading text-lg">Meus pedidos pendentes</h3>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>}
        {pending.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2">
              {editingId === r.id ? (
                <div className="space-y-2">
                  <p className="font-medium">{r.item_name}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Quantidade ({r.unit})</span>
                    <QuantityStepper value={editQty} onChange={setEditQty} disabled={isPending} min={1} />
                  </div>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={isPending}>
                      <Check size={14} /> Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={isPending}>
                      Cancelar edição
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.item_name} — {r.requested_qty} {r.unit}
                    </p>
                    {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(r)} disabled={isPending}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleCancel(r.id)} disabled={isPending}>
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {resolved.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-heading text-base text-muted-foreground">Pedidos recentes resolvidos</h3>
          {resolved.map((r) => (
            <div key={r.id} className="flex justify-between text-sm text-muted-foreground px-1">
              <span>
                {r.item_name} — {r.requested_qty} {r.unit}
              </span>
              <span>{STATUS_LABELS[r.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

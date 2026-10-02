"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInventoryItem, updateInventoryItem } from "@/lib/actions/inventory-items";
import type { InventoryItemWithBalance } from "@/lib/actions/inventory-items";
import type { ExpenseCategory, InventoryTurnoverGroup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

export function InventoryItemFormDialog({
  item,
  categories,
  turnoverGroups,
}: {
  item?: InventoryItemWithBalance;
  categories: ExpenseCategory[];
  turnoverGroups: InventoryTurnoverGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [turnoverGroupId, setTurnoverGroupId] = useState(item?.turnover_group_id ?? "none");
  const router = useRouter();
  const isEdit = !!item;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon">
              <Pencil size={16} />
            </Button>
          ) : (
            <Button>
              <Plus size={16} /> Novo item
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item de estoque" : "Novo item de estoque"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("category_id", categoryId);
            formData.set("turnover_group_id", turnoverGroupId === "none" ? "" : turnoverGroupId);
            startTransition(async () => {
              const result = isEdit ? await updateInventoryItem(item.id, formData) : await createInventoryItem(formData);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success(isEdit ? "Item atualizado." : "Item criado.");
                setOpen(false);
                router.refresh();
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={item?.name} required />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a categoria">
                  {(v: string) => categories.find((c) => c.id === v)?.name ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Input id="unit" name="unit" defaultValue={item?.unit ?? "un"} placeholder="un, kg, L..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder_point">Ponto de reposição</Label>
              <Input id="reorder_point" name="reorder_point" type="number" min={0} defaultValue={item?.reorder_point ?? 0} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Código de barras (opcional)</Label>
            <Input id="barcode" name="barcode" defaultValue={item?.barcode ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Grupo de giro (ciclo de reposição)</Label>
            <Select value={turnoverGroupId} onValueChange={(v) => setTurnoverGroupId(v ?? "none")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhum (sem cálculo automático)">
                  {(v: string) => (v === "none" ? "Nenhum (sem cálculo automático)" : turnoverGroups.find((g) => g.id === v)?.name ?? v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (sem cálculo automático)</SelectItem>
                {turnoverGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} ({g.coverage_days}d de folga)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Deixe &quot;Nenhum&quot; pra itens perecíveis (ex.: frutas) — eles ficam fora do cálculo automático, só
              com o controle visual via &quot;Pedidos de compra&quot;.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portion_weight_kg">Peso médio por porção, em kg (opcional)</Label>
            <Input
              id="portion_weight_kg"
              name="portion_weight_kg"
              type="number"
              min={0}
              step="0.001"
              defaultValue={item?.portion_weight_kg ?? ""}
              placeholder="Só pra itens controlados por porção (ex.: macaxeira, camarão)"
            />
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch id="active" name="active" defaultChecked={item?.active ?? true} />
              <Label htmlFor="active">Ativo</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !categoryId}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

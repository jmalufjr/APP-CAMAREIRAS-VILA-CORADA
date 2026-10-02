"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFixedAsset, updateFixedAsset } from "@/lib/actions/fixed-assets";
import type { FixedAssetWithCategory } from "@/lib/actions/fixed-assets";
import type { AssetCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

export function FixedAssetFormDialog({
  asset,
  categories,
}: {
  asset?: FixedAssetWithCategory;
  categories: AssetCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(asset?.category_id ?? "");
  const router = useRouter();
  const isEdit = !!asset;

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
              <Plus size={16} /> Novo item de ativo permanente
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item de ativo permanente" : "Novo item de ativo permanente"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("category_id", categoryId);
            startTransition(async () => {
              const result = isEdit ? await updateFixedAsset(asset.id, formData) : await createFixedAsset(formData);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success(isEdit ? "Item atualizado." : "Item criado.");
                setOpen(false);
                router.refresh();
              }
            });
          }}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome/descrição</Label>
            <Input id="name" name="name" defaultValue={asset?.name} required />
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
              <Label htmlFor="brand">Marca</Label>
              <Input id="brand" name="brand" defaultValue={asset?.brand ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" name="model" defaultValue={asset?.model ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Data da compra</Label>
              <Input id="purchase_date" name="purchase_date" type="date" defaultValue={asset?.purchase_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_value">Valor da compra (R$)</Label>
              <Input
                id="purchase_value"
                name="purchase_value"
                type="number"
                min={0}
                step="0.01"
                defaultValue={asset?.purchase_value ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="warranty_until">Garantia até</Label>
              <Input id="warranty_until" name="warranty_until" type="date" defaultValue={asset?.warranty_until ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_name">Fornecedor</Label>
              <Input id="supplier_name" name="supplier_name" defaultValue={asset?.supplier_name ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Local (ex.: Suíte 3, Cozinha, Piscina...)</Label>
            <Input id="location" name="location" defaultValue={asset?.location ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" defaultValue={asset?.notes ?? ""} rows={2} />
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch id="active" name="active" defaultChecked={asset?.active ?? true} />
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

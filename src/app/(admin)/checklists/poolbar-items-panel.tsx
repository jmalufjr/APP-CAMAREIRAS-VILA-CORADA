"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PoolbarItem } from "@/lib/types";
import { createPoolbarItem, updatePoolbarItem, deletePoolbarItem } from "@/lib/actions/poolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { RecipeDialog, type RecipeRow } from "@/components/shared/recipe-dialog";
import type { Ingredient } from "@/lib/expense-model-types";

export function PoolbarItemsPanel({
  items,
  recipes,
  ingredients,
}: {
  items: PoolbarItem[];
  recipes: Record<string, RecipeRow[]>;
  ingredients: Ingredient[];
}) {
  const [target, setTarget] = useState<{ id: string; name: string; isNew: boolean } | null>(null);
  const groups = new Map<string, PoolbarItem[]>();
  items.forEach((item) => {
    const key = item.category ?? "Sem categoria";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex justify-end">
        <ItemFormDialog onCreated={(id, name) => setTarget({ id, name, isNew: true })} />
      </div>
      {Array.from(groups.entries()).map(([category, categoryItems]) => (
        <div key={category} className="space-y-2">
          <h3 className="font-heading text-lg">{category}</h3>
          {categoryItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  R$ {item.price.toFixed(2)}
                  {!item.active && " · Inativo"}
                </p>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  {(recipes[item.id]?.length ?? 0) === 0 ? <span className="text-amber-600">Sem ficha técnica</span> : `${recipes[item.id].length} ingrediente(s) na ficha`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setTarget({ id: item.id, name: item.name, isNew: false })}>
                  <UtensilsCrossed size={14} /> Ficha técnica
                </Button>
                <ItemFormDialog item={item} />
                <DeleteButton id={item.id} />
              </div>
            </div>
          ))}
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhum item cadastrado.</p>
      )}
      {target && (
        <RecipeDialog
          key={target.id + JSON.stringify(recipes[target.id] ?? [])}
          open
          onOpenChange={(v) => !v && setTarget(null)}
          productId={target.id}
          productName={target.name}
          rows={recipes[target.id] ?? []}
          ingredients={ingredients}
          isNew={target.isNew}
        />
      )}
    </div>
  );
}

function ItemFormDialog({ item, onCreated }: { item?: PoolbarItem; onCreated?: (id: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
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
          <DialogTitle>{isEdit ? "Editar item" : "Novo item de bar"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = isEdit
                ? await updatePoolbarItem(item.id, formData)
                : await createPoolbarItem(formData);
              if (result?.error) toast.error(result.error);
              else {
                toast.success("Item salvo.");
                setOpen(false);
                router.refresh();
                const newId = (result as { id?: string }).id;
                if (!isEdit && newId) onCreated?.(newId, String(formData.get("name") ?? ""));
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Input id="category" name="category" defaultValue={item?.category ?? ""} placeholder="Ex.: Petiscos, Bebidas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome do item</Label>
            <Input id="name" name="name" defaultValue={item?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Preço (R$)</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={item?.price ?? 0}
              required
            />
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch id="active" name="active" defaultChecked={item?.active ?? true} />
              <Label htmlFor="active">Ativo</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir este item?")) return;
        startTransition(async () => {
          const result = await deletePoolbarItem(id);
          if (result?.error) toast.error(result.error);
          else router.refresh();
        });
      }}
    >
      <Trash2 size={16} />
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MinibarItem } from "@/lib/types";
import { createMinibarItem, updateMinibarItem, deleteMinibarItem } from "@/lib/actions/minibar";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

export function FrigobarItemsPanel({ items }: { items: MinibarItem[] }) {
  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex justify-end">
        <ItemFormDialog />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
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
            </div>
            <div className="flex gap-1 shrink-0">
              <ItemFormDialog item={item} />
              <DeleteButton id={item.id} />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum item cadastrado.</p>
        )}
      </div>
    </div>
  );
}

function ItemFormDialog({ item }: { item?: MinibarItem }) {
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
          <DialogTitle>{isEdit ? "Editar item" : "Novo item de frigobar"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = isEdit
                ? await updateMinibarItem(item.id, formData)
                : await createMinibarItem(formData);
              if (result?.error) toast.error(result.error);
              else {
                toast.success("Item salvo.");
                setOpen(false);
                router.refresh();
              }
            });
          }}
          className="space-y-4"
        >
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
          const result = await deleteMinibarItem(id);
          if (result?.error) toast.error(result.error);
          else router.refresh();
        });
      }}
    >
      <Trash2 size={16} />
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAssetCategory,
  updateAssetCategory,
  deleteAssetCategory,
  createFixedAssetCatalogItem,
  updateFixedAssetCatalogItem,
  deleteFixedAssetCatalogItem,
} from "@/lib/actions/fixed-assets";
import type { AssetCategory, FixedAssetCatalogItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

function DeleteButton({ action }: { action: () => Promise<{ error?: string }> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Tem certeza? Essa ação não pode ser desfeita.")) return;
        startTransition(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
          else {
            toast.success("Removido.");
            router.refresh();
          }
        });
      }}
    >
      <Trash2 size={14} />
    </Button>
  );
}

export function AssetCatalogPanel({
  categories,
  catalogItems,
}: {
  categories: AssetCategory[];
  catalogItems: FixedAssetCatalogItem[];
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg">Categorias</h3>
          <CategoryDialog />
        </div>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <p className="font-medium text-sm">
                {c.name}
                {!c.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativa</span>}
              </p>
              <div className="flex gap-1 shrink-0">
                <CategoryDialog category={c} />
                <DeleteButton action={() => deleteAssetCategory(c.id)} />
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma categoria cadastrada.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg">Catálogo de itens</h3>
          <CatalogItemDialog categories={categories} />
        </div>
        <div className="space-y-2">
          {categories.map((category) => {
            const itemsInCategory = catalogItems.filter((i) => i.category_id === category.id);
            if (itemsInCategory.length === 0) return null;
            return (
              <div key={category.id} className="space-y-1.5">
                <p className="text-xs font-medium uppercase text-muted-foreground">{category.name}</p>
                {itemsInCategory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                    <p className="text-sm">
                      {item.name}
                      {!item.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <CatalogItemDialog item={item} categories={categories} />
                      <DeleteButton action={() => deleteFixedAssetCatalogItem(item.id)} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {catalogItems.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item cadastrado.</p>}
        </div>
      </section>
    </div>
  );
}

function CategoryDialog({ category }: { category?: AssetCategory }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [active, setActive] = useState(category?.active ?? true);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      if (active) formData.set("active", "on");
      const result = isEdit ? await updateAssetCategory(category.id, formData) : await createAssetCategory(formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Categoria salva.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil size={14} />
            </Button>
          ) : (
            <Button size="sm">
              <Plus size={14} /> Nova categoria
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativa
            </label>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatalogItemDialog({ item, categories }: { item?: FixedAssetCatalogItem; categories: AssetCategory[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? "");
  const [active, setActive] = useState(item?.active ?? true);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    if (!categoryId) {
      toast.error("Selecione a categoria.");
      return;
    }
    startTransition(async () => {
      const result = isEdit
        ? await updateFixedAssetCatalogItem(item.id, name, categoryId, active)
        : await createFixedAssetCatalogItem(name, categoryId);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Item do catálogo salvo.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil size={14} />
            </Button>
          ) : (
            <Button size="sm">
              <Plus size={14} /> Novo item do catálogo
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item do catálogo" : "Novo item do catálogo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione">
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
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativo
            </label>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

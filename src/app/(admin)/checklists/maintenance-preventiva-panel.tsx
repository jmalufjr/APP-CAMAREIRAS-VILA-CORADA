"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceCategory, MaintenanceItem, MaintenanceExecutionType } from "@/lib/types";
import { EXECUTION_TYPE_LABELS, periodicityLabel } from "@/lib/maintenance";
import { formatDateShortPt } from "@/lib/date";
import {
  createMaintenanceCategory,
  updateMaintenanceCategory,
  deleteMaintenanceCategory,
  createMaintenanceItem,
  updateMaintenanceItem,
  deleteMaintenanceItem,
} from "@/lib/actions/maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function MaintenancePreventivaPanel({
  categories,
  items,
}: {
  categories: MaintenanceCategory[];
  items: MaintenanceItem[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(categories[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");

  const selectedItems = items.filter((i) => i.category_id === selectedId);

  return (
    <div className="grid md:grid-cols-[minmax(0,280px)_1fr] gap-6">
      <div className="space-y-4">
        <form
          className="space-y-2"
          action={() => {
            if (!newName.trim()) return;
            const fd = new FormData();
            fd.set("name", newName);
            fd.set("start_date", newStartDate);
            startTransition(async () => {
              const result = await createMaintenanceCategory(fd);
              if (result?.error) toast.error(result.error);
              else {
                setNewName("");
                setNewStartDate("");
                router.refresh();
              }
            });
          }}
        >
          <Input placeholder="Nova categoria" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div className="flex gap-2">
            <Input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              title="Data da primeira manutenção (opcional)"
              className="flex-1"
            />
            <Button type="submit" disabled={isPending}>Adicionar</Button>
          </div>
        </form>

        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3 cursor-pointer",
                selectedId === cat.id ? "border-primary bg-muted" : "border-border bg-card"
              )}
              onClick={() => setSelectedId(cat.id)}
            >
              <div>
                <span className="text-sm">{cat.name}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cat.start_date
                    ? `Início: ${formatDateShortPt(cat.start_date)}`
                    : "Início não definido"}
                </p>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Badge variant={cat.active ? "default" : "secondary"}>{cat.active ? "Ativa" : "Inativa"}</Badge>
                <Switch
                  defaultChecked={cat.active}
                  onCheckedChange={(checked) => {
                    const fd = new FormData();
                    fd.set("name", cat.name);
                    if (checked) fd.set("active", "on");
                    startTransition(async () => {
                      await updateMaintenanceCategory(cat.id, fd);
                      router.refresh();
                    });
                  }}
                />
                <CategoryFormDialog category={cat} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!confirm(`Excluir categoria ${cat.name}? Os itens dessa categoria também serão excluídos.`)) return;
                    startTransition(async () => {
                      const result = await deleteMaintenanceCategory(cat.id);
                      if (result?.error) toast.error(result.error);
                      else {
                        if (selectedId === cat.id) setSelectedId(null);
                        router.refresh();
                      }
                    });
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {!selectedId && <p className="text-sm text-muted-foreground">Selecione uma categoria à esquerda.</p>}
        {selectedId && (
          <>
            <div className="flex justify-end">
              <MaintenanceItemFormDialog categoryId={selectedId} items={selectedItems} />
            </div>
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
                >
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={item.execution_type === "tecnico" ? "outline" : "secondary"}>
                        {EXECUTION_TYPE_LABELS[item.execution_type]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {periodicityLabel(item.periodicity_days)}
                      </span>
                      {!item.active && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.follows_category_start_date
                        ? categories.find((c) => c.id === item.category_id)?.start_date
                          ? `Início: ${formatDateShortPt(categories.find((c) => c.id === item.category_id)!.start_date!)} (data da categoria)`
                          : "Início: segue a data da categoria (não definida)"
                        : item.start_date
                          ? `Início: ${formatDateShortPt(item.start_date)} (data própria)`
                          : "Início não definido"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <MaintenanceItemFormDialog categoryId={selectedId} items={selectedItems} item={item} />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => {
                        if (!confirm("Excluir este item?")) return;
                        startTransition(async () => {
                          const result = await deleteMaintenanceItem(item.id);
                          if (result?.error) toast.error(result.error);
                          else router.refresh();
                        });
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              {selectedItems.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum item cadastrado.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CategoryFormDialog({ category }: { category: MaintenanceCategory }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon">
            <Pencil size={16} />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = await updateMaintenanceCategory(category.id, formData);
              if (result?.error) toast.error(result.error);
              else {
                toast.success("Categoria salva.");
                setOpen(false);
                router.refresh();
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="cat_name">Nome</Label>
            <Input id="cat_name" name="name" defaultValue={category.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat_start_date">Data da primeira manutenção</Label>
            <Input id="cat_start_date" name="start_date" type="date" defaultValue={category.start_date ?? ""} />
            <p className="text-xs text-muted-foreground">
              Define/recalcula o cronograma dos itens que seguem a data inicial da categoria.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="cat_active" name="active" defaultChecked={category.active} />
            <Label htmlFor="cat_active">Ativa</Label>
          </div>
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

function MaintenanceItemFormDialog({
  categoryId,
  items,
  item,
}: {
  categoryId: string;
  items: MaintenanceItem[];
  item?: MaintenanceItem;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [executionType, setExecutionType] = useState<MaintenanceExecutionType>(item?.execution_type ?? "nao_tecnico");
  const [followsCategoryStartDate, setFollowsCategoryStartDate] = useState(item?.follows_category_start_date ?? true);
  const [itemStartDate, setItemStartDate] = useState(item?.start_date ?? "");
  const router = useRouter();
  const isEdit = !!item;

  const maxPosition = isEdit ? items.length : items.length + 1;
  const defaultPosition = isEdit
    ? String(Math.max(items.findIndex((i) => i.id === item!.id) + 1, 1))
    : String(maxPosition);
  const [position, setPosition] = useState(defaultPosition);

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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item" : "Novo item de manutenção"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("category_id", categoryId);
            formData.set("execution_type", executionType);
            formData.set("position", position);
            formData.set("follows_category_start_date", followsCategoryStartDate ? "on" : "");
            formData.set("start_date", followsCategoryStartDate ? "" : itemStartDate);
            startTransition(async () => {
              const result = isEdit
                ? await updateMaintenanceItem(item.id, formData)
                : await createMaintenanceItem(formData);
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
            <Label htmlFor="label">Texto do item</Label>
            <Input id="label" name="label" defaultValue={item?.label} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" name="description" defaultValue={item?.description ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Execução</Label>
            <Select value={executionType} onValueChange={(v) => setExecutionType(v as MaintenanceExecutionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao_tecnico">{EXECUTION_TYPE_LABELS.nao_tecnico}</SelectItem>
                <SelectItem value="tecnico">{EXECUTION_TYPE_LABELS.tecnico}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="periodicity_days">Periodicidade (dias)</Label>
            <Input
              id="periodicity_days"
              name="periodicity_days"
              type="number"
              min={1}
              defaultValue={item?.periodicity_days ?? 30}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="follows_start_date">Segue a data inicial da categoria?</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{followsCategoryStartDate ? "Sim" : "Não"}</span>
                <Switch
                  id="follows_start_date"
                  checked={followsCategoryStartDate}
                  onCheckedChange={(checked) => setFollowsCategoryStartDate(!!checked)}
                />
              </div>
            </div>
            {!followsCategoryStartDate && (
              <div className="space-y-1 pt-1">
                <Label htmlFor="item_start_date">Data inicial deste item</Label>
                <Input
                  id="item_start_date"
                  type="date"
                  value={itemStartDate}
                  onChange={(e) => setItemStartDate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Este item passa a ter cronograma próprio, a partir desta data e da periodicidade acima.
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Posição na lista</Label>
            <Select value={position} onValueChange={(v) => setPosition(v ?? defaultPosition)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxPosition }, (_, i) => i + 1).map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {p}
                    {p === 1 ? " (primeiro)" : p === maxPosition ? " (último)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Onde este item aparece na tela do funcionário de manutenção.
            </p>
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

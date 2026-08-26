"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceCategory, MaintenanceItem, MaintenanceExecutionType } from "@/lib/types";
import { EXECUTION_TYPE_LABELS, periodicityLabel } from "@/lib/maintenance";
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

  const selectedItems = items.filter((i) => i.category_id === selectedId);

  return (
    <div className="grid md:grid-cols-[minmax(0,280px)_1fr] gap-6">
      <div className="space-y-4">
        <form
          className="flex gap-2"
          action={() => {
            if (!newName.trim()) return;
            const fd = new FormData();
            fd.set("name", newName);
            startTransition(async () => {
              const result = await createMaintenanceCategory(fd);
              if (result?.error) toast.error(result.error);
              else {
                setNewName("");
                router.refresh();
              }
            });
          }}
        >
          <Input placeholder="Nova categoria" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={isPending}>Adicionar</Button>
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
              <span className="text-sm">{cat.name}</span>
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
              <MaintenanceItemFormDialog categoryId={selectedId} />
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
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <MaintenanceItemFormDialog categoryId={selectedId} item={item} />
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

function MaintenanceItemFormDialog({ categoryId, item }: { categoryId: string; item?: MaintenanceItem }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [executionType, setExecutionType] = useState<MaintenanceExecutionType>(item?.execution_type ?? "nao_tecnico");
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item" : "Novo item de manutenção"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("category_id", categoryId);
            formData.set("execution_type", executionType);
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

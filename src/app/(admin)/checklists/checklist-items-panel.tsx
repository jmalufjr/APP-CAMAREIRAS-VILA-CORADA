"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ChecklistItem, ChecklistType, Room } from "@/lib/types";
import {
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "@/lib/actions/checklists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

export function ChecklistItemsPanel({
  type,
  items,
  rooms,
  assignmentMap,
}: {
  type: ChecklistType;
  items: ChecklistItem[];
  rooms: Room[];
  assignmentMap: Record<string, string[]>;
}) {
  // Animação FLIP: quando a ordem de `items` muda (item novo inserido numa
  // posição, ou posição de um item existente alterada), os cards deslizam
  // visualmente até a nova posição em vez de simplesmente "pular" lá, para
  // deixar visível a ordem escolhida pelo admin.
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, id) => nextRects.set(id, el.getBoundingClientRect()));

    items.forEach((item) => {
      const el = cardRefs.current.get(item.id);
      const before = prevRects.current.get(item.id);
      const after = nextRects.get(item.id);
      if (!el || !before || !after) return;

      const deltaY = before.top - after.top;
      if (!deltaY) return;

      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 250ms ease";
        el.style.transform = "";
      });
    });

    prevRects.current = nextRects;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ItemFormDialog type={type} rooms={rooms} items={items} />
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            ref={(el) => {
              if (el) cardRefs.current.set(item.id, el);
              else cardRefs.current.delete(item.id);
            }}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-0.5">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {(assignmentMap[item.id]?.length ?? 0)} de {rooms.length} quartos
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <ItemFormDialog
                type={type}
                rooms={rooms}
                items={items}
                item={item}
                assignedRoomIds={assignmentMap[item.id] ?? []}
              />
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

function ItemFormDialog({
  type,
  rooms,
  items,
  item,
  assignedRoomIds,
}: {
  type: ChecklistType;
  rooms: Room[];
  items: ChecklistItem[];
  item?: ChecklistItem;
  assignedRoomIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
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
          <DialogTitle>{isEdit ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("type", type);
            formData.set("position", position);
            startTransition(async () => {
              const result = isEdit
                ? await updateChecklistItem(item.id, formData)
                : await createChecklistItem(formData);
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
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea id="description" name="description" defaultValue={item?.description ?? ""} />
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
            <p className="text-xs text-muted-foreground">Onde este item aparece na tela da camareira.</p>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch id="active" name="active" defaultChecked={item?.active ?? true} />
              <Label htmlFor="active">Ativo</Label>
            </div>
          )}
          <div className="space-y-2">
            <Label>Quartos que usam este item</Label>
            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
              {rooms.map((room) => (
                <label key={room.id} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    name="room_ids"
                    value={room.id}
                    defaultChecked={isEdit ? assignedRoomIds?.includes(room.id) : true}
                  />
                  {room.number}
                </label>
              ))}
            </div>
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
          const result = await deleteChecklistItem(id);
          if (result?.error) toast.error(result.error);
          else router.refresh();
        });
      }}
    >
      <Trash2 size={16} />
    </Button>
  );
}

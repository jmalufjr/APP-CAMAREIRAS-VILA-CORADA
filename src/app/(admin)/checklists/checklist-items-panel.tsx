"use client";

import { useState, useTransition } from "react";
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
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ItemFormDialog type={type} rooms={rooms} />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium text-sm">{item.label}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {(assignmentMap[item.id]?.length ?? 0)} de {rooms.length} quartos
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <ItemFormDialog
                type={type}
                rooms={rooms}
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
  item,
  assignedRoomIds,
}: {
  type: ChecklistType;
  rooms: Room[];
  item?: ChecklistItem;
  assignedRoomIds?: string[];
}) {
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            formData.set("type", type);
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

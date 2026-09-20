"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable, DailyBreakfastRoomAssignment, Room } from "@/lib/types";
import { setTableRoomAssignment, removeTableRoomAssignment } from "@/lib/actions/tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

// Edição de quais suítes estão alocadas numa mesa, aberta ao clicar na mesa
// no layout de "Mesas do café" (hoje/amanhã) do admin — substitui os cards
// por mesa que existiam antes. Só o essencial: quais suítes, com qual
// quantidade de hóspedes cada. Uma suíte só pode estar numa mesa por vez —
// escolher uma suíte já alocada em outra mesa aqui a move automaticamente
// (mesmo upsert por date+room_id de sempre, ver setTableRoomAssignment). O
// sistema não permite lançar mais hóspedes do que a mesa comporta.
export function TableAssignmentDialog({
  date,
  table,
  rooms,
  assignments,
  onOpenChange,
}: {
  date: string;
  table: BreakfastTable | null;
  rooms: Room[];
  assignments: DailyBreakfastRoomAssignment[];
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newRoomId, setNewRoomId] = useState("");
  const [newGuestCount, setNewGuestCount] = useState("2");

  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const forThisTable = table ? assignments.filter((a) => a.table_id === table.id) : [];
  const assignedElsewhere = new Set(assignments.map((a) => a.room_id));
  const availableRooms = rooms.filter((r) => !assignedElsewhere.has(r.id));

  function handleAdd() {
    if (!table || !newRoomId) return;
    const guestCount = Number(newGuestCount) || 0;
    if (guestCount > table.seats) {
      toast.error(`Essa mesa comporta no máximo ${table.seats} hóspede${table.seats === 1 ? "" : "s"}.`);
      return;
    }
    startTransition(async () => {
      const result = await setTableRoomAssignment(date, table.id, newRoomId, guestCount);
      if (result?.error) toast.error(result.error);
      else {
        setNewRoomId("");
        setNewGuestCount("2");
        router.refresh();
      }
    });
  }

  function handleRemove(roomId: string) {
    startTransition(async () => {
      const result = await removeTableRoomAssignment(date, roomId);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <Dialog open={table !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{table ? `${table.label} — Suítes` : "Mesa"}</DialogTitle>
        </DialogHeader>
        {table && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Capacidade: {table.seats} hóspedes</p>
            <div className="space-y-1.5">
              {forThisTable.map((a) => (
                <div
                  key={a.room_id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <span>
                    Suíte {roomById.get(a.room_id)?.number ?? "—"} · {a.guest_count} hóspede
                    {a.guest_count === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemove(a.room_id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover suíte desta mesa"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {forThisTable.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Nenhuma suíte alocada nesta mesa.</p>
              )}
            </div>

            {availableRooms.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Suíte</Label>
                  <Select value={newRoomId} onValueChange={(v) => setNewRoomId(v ?? "")} disabled={isPending}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha a suíte" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          Suíte {r.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs text-muted-foreground">Hóspedes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={table.seats}
                    value={newGuestCount}
                    onChange={(e) => setNewGuestCount(e.target.value)}
                  />
                </div>
                <Button type="button" disabled={isPending || !newRoomId} onClick={handleAdd}>
                  Adicionar
                </Button>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

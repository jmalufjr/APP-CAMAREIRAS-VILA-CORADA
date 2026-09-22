"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable, DailyBreakfastRoomAssignment, Room } from "@/lib/types";
import { setTableRoomAssignment, removeTableRoomAssignment, setTableNotes } from "@/lib/actions/tables";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
// por mesa que existiam antes (que também guardavam a quantidade de
// hóspedes e as observações; a quantidade de hóspedes deixou de existir
// como campo — vem sempre da suíte/reserva sincronizada com a Stays — e as
// observações se mudaram pra cá).
//
// Qualquer suíte da pousada pode ser escolhida aqui, mesmo já alocada em
// outra mesa — escolher uma suíte que já está em outra mesa a move pra
// esta (mesmo upsert por date+room_id de sempre, ver
// setTableRoomAssignment: o conflito é por suíte, não por mesa, então a
// linha antiga simplesmente passa a apontar pra mesa nova, sem deixar
// rastro na mesa de origem — ela fica livre pro sistema realocar depois,
// sem nenhuma marca de "editada"). O sistema não permite lançar mais
// hóspedes do que a mesa comporta (a quantidade de hóspedes da suíte é
// resolvida no servidor, não aparece nem é digitada aqui).
export function TableAssignmentDialog({
  date,
  table,
  rooms,
  assignments,
  tableLabelById,
  notes,
  onOpenChange,
}: {
  date: string;
  table: BreakfastTable | null;
  rooms: Room[];
  assignments: DailyBreakfastRoomAssignment[];
  tableLabelById: Map<string, string>;
  notes: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newRoomId, setNewRoomId] = useState("");
  const [notesValue, setNotesValue] = useState(notes);

  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const forThisTable = table ? assignments.filter((a) => a.table_id === table.id) : [];
  // Suítes já alocadas nesta mesma mesa não aparecem no seletor de novo
  // (já estão listadas acima); todas as demais entram, mesmo as alocadas
  // em outra mesa — escolher uma delas move, não duplica.
  const roomsAlreadyHere = new Set(forThisTable.map((a) => a.room_id));
  const elsewhereTableIdByRoomId = new Map(
    table ? assignments.filter((a) => a.table_id !== table.id).map((a) => [a.room_id, a.table_id]) : []
  );
  const selectableRooms = rooms.filter((r) => !roomsAlreadyHere.has(r.id));

  // Sincroniza o valor local sempre que o diálogo abre numa mesa diferente
  // (prop `notes` muda de identidade) — sem useEffect, mesmo padrão de
  // "ajustar estado durante a renderização" já usado no resto do app.
  const [syncedNotes, setSyncedNotes] = useState(notes);
  if (notes !== syncedNotes) {
    setSyncedNotes(notes);
    setNotesValue(notes);
  }

  function handleAdd() {
    if (!table || !newRoomId) return;
    startTransition(async () => {
      const result = await setTableRoomAssignment(date, table.id, newRoomId);
      if (result?.error) toast.error(result.error);
      else {
        setNewRoomId("");
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

  function handleSaveNotes() {
    if (!table) return;
    startTransition(async () => {
      const result = await setTableNotes(date, table.id, notesValue);
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

            {selectableRooms.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Suíte</Label>
                  <Select value={newRoomId} onValueChange={(v) => setNewRoomId(v ?? "")} disabled={isPending}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha a suíte">
                        {(v: string) => {
                          const room = roomById.get(v);
                          if (!room) return v;
                          const elsewhereTableId = elsewhereTableIdByRoomId.get(v);
                          const elsewhereLabel = elsewhereTableId ? tableLabelById.get(elsewhereTableId) : undefined;
                          return `Suíte ${room.number}${elsewhereLabel ? ` (atualmente na ${elsewhereLabel})` : ""}`;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {selectableRooms.map((r) => {
                        const elsewhereTableId = elsewhereTableIdByRoomId.get(r.id);
                        const elsewhereLabel = elsewhereTableId ? tableLabelById.get(elsewhereTableId) : undefined;
                        return (
                          <SelectItem key={r.id} value={r.id}>
                            Suíte {r.number}
                            {elsewhereLabel ? ` (atualmente na ${elsewhereLabel})` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" disabled={isPending || !newRoomId} onClick={handleAdd}>
                  Adicionar
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`table-notes-${table.id}`} className="text-xs text-muted-foreground">
                Observações desta mesa (visível para as camareiras)
              </Label>
              <Textarea
                id={`table-notes-${table.id}`}
                placeholder="Ex.: mesa perto da janela, pedido especial do hóspede etc."
                className="min-h-16 text-sm"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleSaveNotes}
              />
            </div>
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

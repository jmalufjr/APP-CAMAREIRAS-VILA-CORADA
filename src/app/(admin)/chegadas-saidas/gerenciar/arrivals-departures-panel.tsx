"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Room, DailyArrival, DailyDeparture } from "@/lib/types";
import {
  createArrival,
  updateArrival,
  deleteArrival,
  createDeparture,
  updateDeparture,
  deleteDeparture,
} from "@/lib/actions/arrivals-departures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, LogIn, LogOut } from "lucide-react";

export function ArrivalsDeparturesPanel({
  date,
  rooms,
  arrivals,
  departures,
}: {
  date: string;
  rooms: Room[];
  arrivals: DailyArrival[];
  departures: DailyDeparture[];
}) {
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <LogIn size={18} className="text-secondary" /> Chegadas
          </CardTitle>
          <ArrivalFormDialog
            date={date}
            rooms={rooms.filter((r) => !arrivals.some((a) => a.room_id === r.id))}
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {arrivals.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">
                  Quarto {roomById.get(a.room_id)?.number ?? "—"} · {a.guest_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.expected_time ? `Previsto para ${a.expected_time.slice(0, 5)}` : "Horário não informado"}
                </p>
                {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <ArrivalFormDialog date={date} rooms={rooms} arrival={a} />
                <DeleteButton onDelete={() => deleteArrival(a.id)} />
              </div>
            </div>
          ))}
          {arrivals.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma chegada cadastrada.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <LogOut size={18} className="text-secondary" /> Saídas
          </CardTitle>
          <DepartureFormDialog
            date={date}
            rooms={rooms.filter((r) => !departures.some((d) => d.room_id === r.id))}
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {departures.map((d) => (
            <div key={d.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Quarto {roomById.get(d.room_id)?.number ?? "—"}</p>
                {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <DepartureFormDialog date={date} rooms={rooms} departure={d} />
                <DeleteButton onDelete={() => deleteDeparture(d.id)} />
              </div>
            </div>
          ))}
          {departures.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma saída cadastrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ArrivalFormDialog({
  date,
  rooms,
  arrival,
}: {
  date: string;
  rooms: Room[];
  arrival?: DailyArrival;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!arrival;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon">
              <Pencil size={16} />
            </Button>
          ) : (
            <Button size="sm" disabled={rooms.length === 0}>
              <Plus size={16} /> Nova chegada
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar chegada" : "Nova chegada"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = isEdit
                ? await updateArrival(arrival.id, formData)
                : await createArrival(date, formData);
              if (result?.error) toast.error(result.error);
              else {
                toast.success("Chegada salva.");
                setOpen(false);
                router.refresh();
              }
            });
          }}
          className="space-y-4"
        >
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="room_id">Quarto</Label>
              <select
                id="room_id"
                name="room_id"
                required
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Quarto {r.number}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isEdit && (
            <p className="text-sm text-muted-foreground">Quarto {rooms.find((r) => r.id === arrival.room_id)?.number}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="guest_name">Nome do hóspede</Label>
            <Input id="guest_name" name="guest_name" defaultValue={arrival?.guest_name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected_time">Horário previsto</Label>
            <Input
              id="expected_time"
              name="expected_time"
              type="time"
              defaultValue={arrival?.expected_time?.slice(0, 5) ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" defaultValue={arrival?.notes ?? ""} />
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

function DepartureFormDialog({
  date,
  rooms,
  departure,
}: {
  date: string;
  rooms: Room[];
  departure?: DailyDeparture;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!departure;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon">
              <Pencil size={16} />
            </Button>
          ) : (
            <Button size="sm" disabled={rooms.length === 0}>
              <Plus size={16} /> Nova saída
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar saída" : "Nova saída"}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = isEdit
                ? await updateDeparture(departure.id, formData)
                : await createDeparture(date, formData);
              if (result?.error) toast.error(result.error);
              else {
                toast.success("Saída salva.");
                setOpen(false);
                router.refresh();
              }
            });
          }}
          className="space-y-4"
        >
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="room_id_dep">Quarto</Label>
              <select
                id="room_id_dep"
                name="room_id"
                required
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Quarto {r.number}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isEdit && (
            <p className="text-sm text-muted-foreground">
              Quarto {rooms.find((r) => r.id === departure.room_id)?.number}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes_dep">Observações</Label>
            <Textarea id="notes_dep" name="notes" defaultValue={departure?.notes ?? ""} />
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

function DeleteButton({ onDelete }: { onDelete: () => Promise<{ error?: string } | undefined> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir este registro?")) return;
        startTransition(async () => {
          const result = await onDelete();
          if (result?.error) toast.error(result.error);
          else router.refresh();
        });
      }}
    >
      <Trash2 size={16} />
    </Button>
  );
}

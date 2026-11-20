"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable, TableShape, TableSize } from "@/lib/types";
import { createBreakfastTable, deleteBreakfastTable, saveTableLayout, updateTableSeatsAndSize, type TablePosition } from "@/lib/actions/tables";
import { TABLE_SIZES, TABLE_SIZE_LABELS, defaultTableSize } from "@/lib/table-size";
import { TableLayoutCanvas } from "@/components/shared/table-layout-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Pencil } from "lucide-react";

export function TableLayoutPanel({ tables }: { tables: BreakfastTable[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [pendingPositions, setPendingPositions] = useState<TablePosition[] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">Arraste as mesas para reorganizar o layout.</p>
        <div className="flex gap-2">
          <NewTableForm />
          {pendingPositions && (
            <Button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await saveTableLayout(pendingPositions);
                  toast.success("Layout salvo.");
                  setPendingPositions(null);
                  router.refresh();
                })
              }
            >
              Salvar layout
            </Button>
          )}
        </div>
      </div>
      <TableLayoutCanvas tables={tables} editable onPositionsChange={setPendingPositions} />
      <div className="grid sm:grid-cols-2 gap-3">
        {tables.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 bg-card">
            <div>
              <p className="font-medium text-sm">{t.label}</p>
              <p className="text-xs text-muted-foreground">
                {t.shape === "round" ? "Redonda" : t.shape === "square" ? "Quadrada" : "Retangular"} · {t.seats}{" "}
                lugares · Tamanho {TABLE_SIZE_LABELS[t.size ?? "pequeno"].toLowerCase()}
              </p>
            </div>
            <div className="flex items-center">
            <EditTableButton table={t} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!confirm(`Excluir ${t.label}?`)) return;
                startTransition(async () => {
                  await deleteBreakfastTable(t.id);
                  router.refresh();
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
  );
}

function NewTableForm() {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState("round");
  const [size, setSize] = useState<TableSize>("pequeno");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus size={16} /> Nova mesa
      </Button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      action={(formData) => {
        startTransition(async () => {
          const result = await createBreakfastTable(formData);
          if (result?.error) toast.error(result.error);
          else {
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <Input name="label" placeholder="Nome" className="w-28" required />
      <Select
        value={shape}
        onValueChange={(v) => {
          const next = v ?? "round";
          setShape(next);
          setSize(defaultTableSize(next as TableShape));
        }}
      >
        <SelectTrigger className="w-32">
          <SelectValue>
            {(v: string) =>
              v === "round" ? "Redonda" : v === "square" ? "Quadrada" : "Retangular"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="round">Redonda</SelectItem>
          <SelectItem value="square">Quadrada</SelectItem>
          <SelectItem value="rect">Retangular</SelectItem>
        </SelectContent>
      </Select>
      <input type="hidden" name="shape" value={shape} />
      <Input name="seats" type="number" defaultValue={2} min={1} className="w-16" title="Quantidade de hóspedes" aria-label="Quantidade de hóspedes" />
      <Select value={size} onValueChange={(v) => setSize((v ?? "pequeno") as TableSize)}>
        <SelectTrigger className="w-28" aria-label="Tamanho da mesa">
          <SelectValue>{(v: string) => TABLE_SIZE_LABELS[v as TableSize] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TABLE_SIZES.map((sz) => (
            <SelectItem key={sz} value={sz}>
              {TABLE_SIZE_LABELS[sz]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="size" value={size} />
      <Button type="submit" size="sm" disabled={isPending}>Adicionar</Button>
    </form>
  );
}

// Lápis do card de cada mesa: muda a quantidade de hóspedes e o tamanho (as dimensões são recalculadas).
function EditTableButton({ table }: { table: BreakfastTable }) {
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(String(table.seats));
  const [size, setSize] = useState<TableSize>(table.size ?? "pequeno");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpen() {
    setSeats(String(table.seats));
    setSize(table.size ?? "pequeno");
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateTableSeatsAndSize(table.id, Number(seats), size);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Mesa atualizada.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={handleOpen} aria-label={`Editar ${table.label}`} title="Editar quantidade de hóspedes e tamanho">
        <Pencil size={16} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {table.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`seats-${table.id}`}>Quantidade de hóspedes</Label>
              <Input id={`seats-${table.id}`} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tamanho da mesa</Label>
              <Select value={size} onValueChange={(v) => setSize((v ?? "pequeno") as TableSize)}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => TABLE_SIZE_LABELS[v as TableSize] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TABLE_SIZES.map((sz) => (
                    <SelectItem key={sz} value={sz}>
                      {TABLE_SIZE_LABELS[sz]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Cada tamanho é 50% maior que o anterior (na retangular, só o lado maior).</p>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isPending || Number(seats) < 1} onClick={handleSave}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

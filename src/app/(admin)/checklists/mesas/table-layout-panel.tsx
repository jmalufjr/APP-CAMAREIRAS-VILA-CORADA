"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BreakfastTable } from "@/lib/types";
import { createBreakfastTable, deleteBreakfastTable, saveTableLayout, type TablePosition } from "@/lib/actions/tables";
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
import { Trash2, Plus } from "lucide-react";

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
                {t.shape === "round" ? "Redonda" : "Retangular"} · {t.seats} lugares
              </p>
            </div>
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
        ))}
      </div>
    </div>
  );
}

function NewTableForm() {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState("round");
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
      <Select value={shape} onValueChange={(v) => setShape(v ?? "round")}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="round">Redonda</SelectItem>
          <SelectItem value="rect">Retangular</SelectItem>
        </SelectContent>
      </Select>
      <input type="hidden" name="shape" value={shape} />
      <Input name="seats" type="number" defaultValue={2} min={1} className="w-16" />
      <Button type="submit" size="sm" disabled={isPending}>Adicionar</Button>
    </form>
  );
}

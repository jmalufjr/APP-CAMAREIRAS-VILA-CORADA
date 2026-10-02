"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InventoryTurnoverGroup } from "@/lib/types";
import {
  createInventoryTurnoverGroup,
  updateInventoryTurnoverGroupCoverageDays,
  deleteInventoryTurnoverGroup,
} from "@/lib/actions/inventory-turnover-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

export function TurnoverGroupsPanel({ groups }: { groups: InventoryTurnoverGroup[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newDays, setNewDays] = useState("");
  const [editingDays, setEditingDays] = useState<Record<string, string>>(
    Object.fromEntries(groups.map((g) => [g.id, String(g.coverage_days)]))
  );

  function handleSaveDays(id: string) {
    const value = Number(editingDays[id]);
    if (!value || value <= 0) {
      toast.error("Informe um número de dias maior que zero.");
      return;
    }
    startTransition(async () => {
      const result = await updateInventoryTurnoverGroupCoverageDays(id, value);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Dias de folga atualizados.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      <form
        className="flex gap-2"
        action={() => {
          if (!newName.trim() || !newDays) return;
          const fd = new FormData();
          fd.set("name", newName);
          fd.set("coverage_days", newDays);
          startTransition(async () => {
            const result = await createInventoryTurnoverGroup(fd);
            if (result?.error) toast.error(result.error);
            else {
              setNewName("");
              setNewDays("");
              router.refresh();
            }
          });
        }}
      >
        <Input placeholder="Novo grupo de giro" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Input
          type="number"
          min={1}
          placeholder="Dias"
          className="w-24"
          value={newDays}
          onChange={(e) => setNewDays(e.target.value)}
        />
        <Button type="submit" disabled={isPending}>
          Adicionar
        </Button>
      </form>

      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <span className="text-sm flex-1">{g.name}</span>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                className="w-20"
                value={editingDays[g.id] ?? ""}
                onChange={(e) => setEditingDays((prev) => ({ ...prev, [g.id]: e.target.value }))}
                onBlur={() => {
                  if (editingDays[g.id] !== String(g.coverage_days)) handleSaveDays(g.id);
                }}
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`Excluir o grupo "${g.name}"? Itens ligados a ele ficam sem grupo.`)) return;
                startTransition(async () => {
                  const result = await deleteInventoryTurnoverGroup(g.id);
                  if (result?.error) toast.error(result.error);
                  else router.refresh();
                });
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum grupo cadastrado.</p>}
      </div>
    </div>
  );
}

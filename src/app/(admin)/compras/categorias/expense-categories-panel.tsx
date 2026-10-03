"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/lib/types";
import { createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from "@/lib/actions/expense-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";

export function ExpenseCategoriesPanel({ categories }: { categories: ExpenseCategory[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newIsInventory, setNewIsInventory] = useState(false);

  return (
    <div className="space-y-4 max-w-lg">
      <form
        className="space-y-2 rounded-lg border border-border p-3"
        action={() => {
          if (!newName.trim()) return;
          const fd = new FormData();
          fd.set("name", newName);
          if (newIsInventory) fd.set("is_inventory_category", "on");
          startTransition(async () => {
            const result = await createExpenseCategory(fd);
            if (result?.error) toast.error(result.error);
            else {
              setNewName("");
              setNewIsInventory(false);
              router.refresh();
            }
          });
        }}
      >
        <Input placeholder="Nova categoria de gasto" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={newIsInventory} onCheckedChange={(c) => setNewIsInventory(c === true)} />
          Controla itens de estoque (ex.: produtos de limpeza, piscina)
        </label>
        <Button type="submit" disabled={isPending}>
          Adicionar
        </Button>
      </form>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div>
              <p className="text-sm">{cat.name}</p>
              {cat.is_inventory_category && (
                <p className="text-xs text-muted-foreground">Controla estoque</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={cat.active ? "default" : "secondary"}>{cat.active ? "Ativa" : "Inativa"}</Badge>
              <Switch
                defaultChecked={cat.active}
                onCheckedChange={(checked) => {
                  const fd = new FormData();
                  fd.set("name", cat.name);
                  if (cat.is_inventory_category) fd.set("is_inventory_category", "on");
                  if (checked) fd.set("active", "on");
                  startTransition(async () => {
                    await updateExpenseCategory(cat.id, fd);
                    router.refresh();
                  });
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!confirm(`Excluir categoria ${cat.name}?`)) return;
                  startTransition(async () => {
                    const result = await deleteExpenseCategory(cat.id);
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
      </div>
    </div>
  );
}

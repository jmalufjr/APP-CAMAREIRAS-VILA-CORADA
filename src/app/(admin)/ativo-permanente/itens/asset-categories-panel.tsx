"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AssetCategory } from "@/lib/types";
import { createAssetCategory, updateAssetCategory, deleteAssetCategory } from "@/lib/actions/fixed-assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

export function AssetCategoriesPanel({ categories }: { categories: AssetCategory[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-4 max-w-lg">
      <form
        className="flex gap-2"
        action={() => {
          if (!newName.trim()) return;
          const fd = new FormData();
          fd.set("name", newName);
          startTransition(async () => {
            const result = await createAssetCategory(fd);
            if (result?.error) toast.error(result.error);
            else {
              setNewName("");
              router.refresh();
            }
          });
        }}
      >
        <Input placeholder="Nova categoria de ativo permanente" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" disabled={isPending}>
          Adicionar
        </Button>
      </form>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <span className="text-sm">{cat.name}</span>
            <div className="flex items-center gap-3">
              <Badge variant={cat.active ? "default" : "secondary"}>{cat.active ? "Ativa" : "Inativa"}</Badge>
              <Switch
                defaultChecked={cat.active}
                onCheckedChange={(checked) => {
                  const fd = new FormData();
                  fd.set("name", cat.name);
                  if (checked) fd.set("active", "on");
                  startTransition(async () => {
                    await updateAssetCategory(cat.id, fd);
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
                    const result = await deleteAssetCategory(cat.id);
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { saveBarProductRecipe } from "@/lib/actions/product-cost";
import type { Ingredient } from "@/lib/expense-model-types";

export interface RecipeRow {
  ingredient_id: string;
  quantity: number;
}

// Ficha técnica de UM item do cardápio do bar (ingredientes e quantidade por unidade vendida).
// Controlada pelo pai (open/onOpenChange); o pai deve recriar o componente (key) ao trocar de item.
export function RecipeDialog({
  open,
  onOpenChange,
  productId,
  productName,
  rows: initialRows,
  ingredients,
  isNew = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
  rows: RecipeRow[];
  ingredients: Ingredient[];
  isNew?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [rows, setRows] = useState<{ ingredientId: string; quantity: string }[]>(
    initialRows.map((i) => ({ ingredientId: i.ingredient_id, quantity: String(i.quantity) }))
  );

  function save() {
    startTransition(async () => {
      const r = await saveBarProductRecipe(
        productId,
        rows.map((x) => ({ ingredientId: x.ingredientId, quantity: Number(x.quantity.replace(",", ".")) }))
      );
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Ficha técnica salva.");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ficha técnica — {productName}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Preencha a ficha técnica: quais ingredientes entram e quanto em uma unidade vendida."
              : "Quais ingredientes entram e quanto em uma unidade vendida."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className="h-9 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={r.ingredientId}
                onChange={(e) => setRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, ingredientId: e.target.value } : x)))}
              >
                <option value="">Ingrediente…</option>
                {ingredients.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <Input
                className="w-24"
                inputMode="decimal"
                placeholder="Qtd."
                value={r.quantity}
                onChange={(e) => setRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)))}
              />
              <Button variant="ghost" size="icon-sm" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { ingredientId: "", quantity: "1" }])}>
            <Plus size={14} /> Adicionar ingrediente
          </Button>
          <p className="text-xs text-muted-foreground">
            Só entram aqui os ingredientes cadastrados em “Ingredientes de bar da piscina” (use a mesma medida do ingrediente em todos os produtos).
          </p>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

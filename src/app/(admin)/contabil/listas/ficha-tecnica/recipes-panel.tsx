"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { saveBarProductRecipe } from "@/lib/actions/product-cost";
import type { Ingredient } from "@/lib/expense-model-types";
import type { BarProductRecipe } from "@/lib/product-cost-types";

function RecipeDialog({ product, ingredients }: { product: BarProductRecipe; ingredients: Ingredient[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [rows, setRows] = useState<{ ingredientId: string; quantity: string }[]>(
    product.ingredients.map((i) => ({ ingredientId: i.ingredient_id, quantity: String(i.quantity) }))
  );

  function save() {
    startTransition(async () => {
      const r = await saveBarProductRecipe(
        product.id,
        rows.map((x) => ({ ingredientId: x.ingredientId, quantity: Number(x.quantity.replace(",", ".")) }))
      );
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Ficha salva.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <Pencil size={14} />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ficha técnica — {product.name}</DialogTitle>
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
          <p className="text-xs text-muted-foreground">Quantidade em uma unidade vendida. Só entram aqui os ingredientes cadastrados em “Ingredientes de produtos de bar”.</p>
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

export function RecipesPanel({ products, ingredients }: { products: BarProductRecipe[]; ingredients: Ingredient[] }) {
  return (
    <div className="space-y-2 max-w-3xl">
      {products.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="min-w-0">
            <p className="font-medium text-sm">
              {p.name}
              {p.category && <span className="ml-1.5 text-xs text-muted-foreground">· {p.category}</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {p.ingredients.length === 0 ? "Sem ingredientes cadastrados" : p.ingredients.map((i) => `${i.ingredient_name} (${i.quantity})`).join(" · ")}
            </p>
          </div>
          <RecipeDialog key={JSON.stringify(p.ingredients)} product={p} ingredients={ingredients} />
        </div>
      ))}
      {products.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum produto do bar cadastrado.</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DishView, IngredientOption } from "@/lib/actions/inventory-items";
import { addInventoryItemRecipe, removeInventoryItemRecipe, updateInventoryItemRecipeQuantities } from "@/lib/actions/inventory-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

// "Ficha técnica de petiscos e drinks" — ver PRD_compras.md seção 21.
// Mesma ficha técnica da tela "Itens de estoque", só que organizada a
// partir do PRATO/produto do bar da piscina em vez do ingrediente — não
// existe um catálogo de "pratos" separado: a lista abaixo é o próprio
// cardápio já cadastrado em Bar da Piscina (frigobar não entra mais
// aqui, e o ingrediente só pode vir dos subcentros Alimentos/Bebidas/
// Materiais de bar da piscina — ver getFichaTecnicaIngredientOptions).
export function DishesPanel({ dishes, ingredients }: { dishes: DishView[]; ingredients: IngredientOption[] }) {
  const grouped = {
    Petiscos: dishes.filter((d) => d.category === "Petiscos"),
    Drinks: dishes.filter((d) => d.category !== "Petiscos"),
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([groupLabel, groupDishes]) => (
        <div key={groupLabel} className="space-y-2">
          <h3 className="font-heading text-lg">{groupLabel}</h3>
          {groupDishes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
          {groupDishes.map((dish) => (
            <DishCard key={`${dish.kind}-${dish.id}`} dish={dish} ingredients={ingredients} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DishCard({ dish, ingredients }: { dish: DishView; ingredients: IngredientOption[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [ingredientId, setIngredientId] = useState("");
  const [portionsCount, setPortionsCount] = useState("1");
  const [amountPerPortion, setAmountPerPortion] = useState("1");

  const alreadyLinkedIds = new Set(dish.ingredients.map((i) => i.inventory_item_id));
  const availableIngredients = ingredients.filter((i) => !alreadyLinkedIds.has(i.inventory_item_id));
  const selectedIngredientUnit = ingredients.find((i) => i.inventory_item_id === ingredientId)?.unit ?? "un";

  function handleAdd() {
    startTransition(async () => {
      const result = await addInventoryItemRecipe(
        ingredientId,
        dish.kind,
        dish.id,
        Number(portionsCount),
        Number(amountPerPortion)
      );
      if (result?.error) toast.error(result.error);
      else {
        setIngredientId("");
        setPortionsCount("1");
        setAmountPerPortion("1");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-sm font-medium">{dish.name}</p>

      {dish.ingredients.length === 0 && (
        <p className="text-xs text-muted-foreground">Ainda sem receita cadastrada — adicione os ingredientes abaixo.</p>
      )}
      {dish.ingredients.length > 0 && (
        <div className="space-y-1.5">
          {dish.ingredients.map((ing) => (
            <IngredientRow key={ing.recipe_id} ingredient={ing} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-1">
        <Select value={ingredientId} onValueChange={(v) => setIngredientId(v ?? "")}>
          <SelectTrigger className="min-w-48 flex-1">
            <SelectValue placeholder="Ingrediente (item de estoque)">
              {(v: string) => ingredients.find((i) => i.inventory_item_id === v)?.name ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableIngredients.map((i) => (
              <SelectItem key={i.inventory_item_id} value={i.inventory_item_id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0.001}
          step="0.001"
          className="w-24"
          value={portionsCount}
          onChange={(e) => setPortionsCount(e.target.value)}
          placeholder="Porções"
          title="Quantidade de porções do ingrediente que vão no prato"
        />
        <Input
          type="number"
          min={0}
          step="0.0001"
          className="w-28"
          value={amountPerPortion}
          onChange={(e) => setAmountPerPortion(e.target.value)}
          placeholder={`${selectedIngredientUnit}/porção`}
          title={`Quantidade do ingrediente em 1 porção, na unidade dele`}
        />
        <Button size="sm" disabled={isPending || !ingredientId} onClick={handleAdd}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function IngredientRow({
  ingredient,
}: {
  ingredient: { recipe_id: string; item_name: string; item_unit: string; portions_count: number; amount_per_portion: number };
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [portionsCount, setPortionsCount] = useState(String(ingredient.portions_count));
  const [amountPerPortion, setAmountPerPortion] = useState(String(ingredient.amount_per_portion));

  function handleSave() {
    startTransition(async () => {
      const result = await updateInventoryItemRecipeQuantities(ingredient.recipe_id, Number(portionsCount), Number(amountPerPortion));
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Receita atualizada.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2 text-sm">
      <span className="flex-1 min-w-32">{ingredient.item_name}</span>
      <Input
        type="number"
        min={0.001}
        step="0.001"
        className="w-20"
        value={portionsCount}
        onChange={(e) => setPortionsCount(e.target.value)}
        title="Porções"
      />
      <span className="text-xs text-muted-foreground">porção(ões) ×</span>
      <Input
        type="number"
        min={0}
        step="0.0001"
        className="w-24"
        value={amountPerPortion}
        onChange={(e) => setAmountPerPortion(e.target.value)}
        title={`${ingredient.item_unit}/porção`}
      />
      <span className="text-xs text-muted-foreground">{ingredient.item_unit}/porção</span>
      <Button size="sm" variant="outline" disabled={isPending} onClick={handleSave}>
        Salvar
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await removeInventoryItemRecipe(ingredient.recipe_id);
            if (result?.error) toast.error(result.error);
            else router.refresh();
          });
        }}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

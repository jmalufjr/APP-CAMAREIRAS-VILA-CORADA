"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { setIngredientConsumptionDays } from "@/lib/actions/expense-model";
import type { Ingredient } from "@/lib/expense-model-types";

function Row({ ingredient }: { ingredient: Ingredient }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState(String(ingredient.consumption_days));

  function save() {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      toast.error("O prazo deve ficar entre 1 e 365 dias.");
      setDays(String(ingredient.consumption_days));
      return;
    }
    if (n === ingredient.consumption_days) return;
    startTransition(async () => {
      const r = await setIngredientConsumptionDays(ingredient.id, n);
      if (r?.error) {
        toast.error(r.error);
        setDays(String(ingredient.consumption_days));
      } else {
        toast.success(`Prazo de "${ingredient.name}" salvo.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-1.5">
      <span className="text-sm min-w-0 truncate">
        {ingredient.name}
        {!ingredient.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
      </span>
      <span className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
        consumo em
        <Input
          className="h-8 w-16 text-center"
          type="number"
          min={1}
          max={365}
          value={days}
          disabled={isPending}
          onChange={(e) => setDays(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        dia(s)
      </span>
    </div>
  );
}

// Itens (ingredientes) da categoria Alimentos, cada um com o seu prazo de consumo.
export function AlimentosItems({ ingredients }: { ingredients: Ingredient[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Itens de Alimentos e prazo de consumo de cada um ({ingredients.length})
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            O prazo de cada item vale para compras lançadas em Alimentos e ligadas a ele. Item novo nasce com 30 dias. Compras de Alimentos sem item
            cadastrado seguem o prazo da categoria. Aqui só aparecem alimentos (cafés inclusive); bebidas seguem o prazo da sua categoria. Para cadastrar um item novo, use “Ingredientes de bar da piscina”.
          </p>
          {ingredients.map((i) => (
            <Row key={`${i.id}-${i.consumption_days}`} ingredient={i} />
          ))}
          {ingredients.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item cadastrado.</p>}
        </div>
      )}
    </div>
  );
}

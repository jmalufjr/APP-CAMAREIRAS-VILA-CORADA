"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { DeleteButton } from "@/components/shared/delete-button";
import { saveIngredient, deleteIngredient } from "@/lib/actions/expense-model";
import { INGREDIENT_KIND_LABELS, type Ingredient, type IngredientKind } from "@/lib/expense-model-types";

function IngredientDialog({ ingredient }: { ingredient?: Ingredient }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!ingredient;
  const [name, setName] = useState(ingredient?.name ?? "");
  const [barPct, setBarPct] = useState(String(ingredient?.bar_pct ?? 50));
  const [active, setActive] = useState(ingredient?.active ?? true);
  const [days, setDays] = useState(String(ingredient?.consumption_days ?? 30));
  const [kind, setKind] = useState<IngredientKind>(ingredient?.kind ?? "alimento");
  const [splitMode, setSplitMode] = useState<"bar_cafe" | "bar_frigobar">(ingredient?.split_mode ?? "bar_cafe");

  function handleSave() {
    startTransition(async () => {
      const r = await saveIngredient(ingredient?.id ?? null, name, Number(barPct), active, splitMode, Number(days), kind);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Ingrediente salvo.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil size={14} />
            </Button>
          ) : (
            <Button size="sm">
              <Plus size={14} /> Novo ingrediente
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ingrediente" : "Novo ingrediente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome (como aparece nas notas, ex.: limão, cachaça)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as IngredientKind)}
            >
              {(Object.keys(INGREDIENT_KIND_LABELS) as IngredientKind[]).map((k) => (
                <option key={k} value={k}>
                  {INGREDIENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            {kind !== "alimento" && (
              <p className="text-xs text-muted-foreground">Bebidas seguem o prazo de consumo e o rateio da própria categoria (Bebidas quentes / Demais bebidas).</p>
            )}
          </div>
          {kind === "alimento" && (
            <>
          <div className="space-y-1.5">
            <Label>Como o gasto se divide (vale para alimentos)</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={splitMode}
              onChange={(e) => setSplitMode(e.target.value as "bar_cafe" | "bar_frigobar")}
            >
              <option value="bar_cafe">Bar × Café da manhã (percentual abaixo)</option>
              <option value="bar_frigobar">Bar × Frigobar (pelas vendas do mês, ex.: café expresso)</option>
            </select>
          </div>
          {splitMode === "bar_cafe" && (
            <div className="space-y-1.5">
              <Label>% do gasto que vai para o Bar (o resto vai para o Café)</Label>
              <Input type="number" min={0} max={100} value={barPct} onChange={(e) => setBarPct(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Prazo de consumo (dias) — para compras de Alimentos</Label>
            <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
            </>
          )}
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativo
            </label>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IngredientsPanel({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <IngredientDialog />
      </div>
      <div className="space-y-2">
        {ingredients.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="font-medium text-sm">
                {i.name}
                {!i.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {i.kind !== "alimento"
                  ? INGREDIENT_KIND_LABELS[i.kind]
                  : i.split_mode === "bar_frigobar"
                    ? `Alimento · Bar × Frigobar (pelas vendas do mês) · ${i.consumption_days} dia(s)`
                    : `Alimento · Bar ${i.bar_pct}% · Café ${Math.round((100 - i.bar_pct) * 100) / 100}% · ${i.consumption_days} dia(s)`}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <IngredientDialog ingredient={i} />
              <DeleteButton action={() => deleteIngredient(i.id)} />
            </div>
          </div>
        ))}
        {ingredients.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum ingrediente cadastrado.</p>}
      </div>
    </section>
  );
}

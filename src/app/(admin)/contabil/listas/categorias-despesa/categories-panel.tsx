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
import { saveExpenseCategory, deleteExpenseCategory } from "@/lib/actions/expense-model";
import { CENTER_LABELS, RULE_LABELS, type CenterCode, type ExpenseCategory, type Ingredient } from "@/lib/expense-model-types";
import { AlimentosItems } from "./alimentos-items";

const CENTER_CODES: CenterCode[] = ["hospedagem", "bar", "cafe", "frigobar"];

function CategoryDialog({ category }: { category?: ExpenseCategory }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!category;
  const rule = category?.rule ?? "fixo";

  const [name, setName] = useState(category?.name ?? "");
  const [days, setDays] = useState(String(category?.consumption_days ?? 1));
  const [active, setActive] = useState(category?.active ?? true);
  const [pcts, setPcts] = useState<Record<CenterCode, string>>(() => {
    const base: Record<CenterCode, string> = { hospedagem: "", bar: "", cafe: "", frigobar: "" };
    if (category) for (const c of category.centers) base[c.center_code] = String(c.pct);
    else base.hospedagem = "100";
    return base;
  });

  function handleSave() {
    startTransition(async () => {
      const centers = CENTER_CODES.map((code) => ({ center_code: code, pct: Number(pcts[code] || 0) }));
      const result = await saveExpenseCategory(category?.id ?? null, name, Number(days), active, centers);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Categoria salva.");
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
              <Plus size={14} /> Nova categoria
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria de despesa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo de consumo (dias)</Label>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              1 = consumo imediato (cai todo no mês da compra). Acima de 1, o valor da nota é dividido por dia e distribuído entre os meses a partir da data da compra.
            </p>
          </div>
          {rule === "fixo" ? (
            <div className="space-y-1.5">
              <Label>Rateio entre os centros (%, deve somar 100)</Label>
              <div className="grid grid-cols-2 gap-2">
                {CENTER_CODES.map((code) => (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0">{CENTER_LABELS[code]}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={pcts[code]}
                      onChange={(e) => setPcts((p) => ({ ...p, [code]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Rateio: {RULE_LABELS[rule]}. Essa regra é fixa do sistema.</p>
          )}
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativa
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

export function CategoriesPanel({ categories, ingredients = [] }: { categories: ExpenseCategory[]; ingredients?: Ingredient[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg">Categorias de despesa</h3>
        <CategoryDialog />
      </div>
      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div className="min-w-0">
              <p className="font-medium text-sm">
                {c.name}
                {!c.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativa</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consumo em {c.consumption_days} dia(s){c.rule === "alimentos" ? " (itens sem cadastro)" : ""} ·{" "}
                {c.rule === "fixo"
                  ? c.centers.map((x) => `${CENTER_LABELS[x.center_code]} ${x.pct}%`).join(" · ")
                  : RULE_LABELS[c.rule]}
              </p>
              {c.rule === "alimentos" && <AlimentosItems ingredients={ingredients.filter((i) => i.kind === "alimento")} />}
            </div>
            <div className="flex gap-1 shrink-0">
              <CategoryDialog category={c} />
              <DeleteButton action={() => deleteExpenseCategory(c.id)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

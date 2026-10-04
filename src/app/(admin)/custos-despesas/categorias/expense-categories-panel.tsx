"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory, CostNature } from "@/lib/types";
import {
  createExpenseCategory,
  updateExpenseCategory,
  updateExpenseCategoryCostSettings,
  deleteExpenseCategory,
} from "@/lib/actions/expense-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Trash2 } from "lucide-react";

const COST_NATURE_LABELS: Record<CostNature, string> = {
  custo_direto: "Custo direto (já calculado por outra regra)",
  custo_fixo: "Custo fixo (rateado pelos percentuais abaixo)",
  nao_custo: "Não é custo (ex.: ativo permanente)",
};

export function ExpenseCategoriesPanel({ categories }: { categories: ExpenseCategory[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newIsInventory, setNewIsInventory] = useState(false);

  return (
    <div className="space-y-4 max-w-2xl">
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
        <p className="text-xs text-muted-foreground">
          Categoria nova entra como &quot;custo fixo&quot;, 100% hospedagem — ajuste a natureza e o rateio no card dela
          abaixo depois de criada.
        </p>
      </form>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{cat.name}</p>
                {cat.is_inventory_category && <p className="text-xs text-muted-foreground">Controla estoque</p>}
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

            <CategoryCostFields category={cat} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryCostFields({ category }: { category: ExpenseCategory }) {
  const [isPending, startTransition] = useTransition();
  const [costNature, setCostNature] = useState<CostNature>(category.cost_nature);
  const [hospedagem, setHospedagem] = useState(category.alloc_hospedagem_pct);
  const [cafeManha, setCafeManha] = useState(category.alloc_cafe_manha_pct);
  const [bar, setBar] = useState(category.alloc_bar_pct);
  const [frigobar, setFrigobar] = useState(category.alloc_frigobar_pct);

  const sum = hospedagem + cafeManha + bar + frigobar;
  const sumOk = sum === 100;

  function handleSave() {
    startTransition(async () => {
      const result = await updateExpenseCategoryCostSettings(category.id, costNature, {
        hospedagem,
        cafeManha,
        bar,
        frigobar,
      });
      if (result?.error) toast.error(result.error);
      else toast.success("Natureza de custo atualizada.");
    });
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Natureza de custo</label>
        <Select value={costNature} onValueChange={(v) => setCostNature((v as CostNature) ?? "custo_fixo")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => COST_NATURE_LABELS[v as CostNature] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COST_NATURE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {costNature === "custo_fixo" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Rateio entre os centros de custo (precisa somar 100%) — soma atual:{" "}
            <span className={sumOk ? "text-foreground" : "text-destructive font-medium"}>{sum}%</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Hospedagem</p>
              <div className="flex items-center gap-1">
                <QuantityStepper value={hospedagem} onChange={setHospedagem} min={0} max={100} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Café da manhã</p>
              <div className="flex items-center gap-1">
                <QuantityStepper value={cafeManha} onChange={setCafeManha} min={0} max={100} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Serviço de bar</p>
              <div className="flex items-center gap-1">
                <QuantityStepper value={bar} onChange={setBar} min={0} max={100} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Frigobar</p>
              <div className="flex items-center gap-1">
                <QuantityStepper value={frigobar} onChange={setFrigobar} min={0} max={100} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Button size="sm" disabled={isPending || (costNature === "custo_fixo" && !sumOk)} onClick={handleSave}>
        Salvar natureza de custo
      </Button>
    </div>
  );
}

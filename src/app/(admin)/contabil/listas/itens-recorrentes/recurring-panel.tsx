"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, ArrowRightLeft } from "lucide-react";
import { DeleteButton } from "@/components/shared/delete-button";
import { saveRecurringExpense, deleteRecurringExpense } from "@/lib/actions/expense-model";
import { moveRecurringToExpense } from "@/lib/actions/move-expense";
import type { ExpenseCategory, RecurringExpense } from "@/lib/expense-model-types";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RecurringDialog({ item, categories }: { item?: RecurringExpense; categories: ExpenseCategory[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [amount, setAmount] = useState(item ? String(item.amount) : "");
  const [day, setDay] = useState(String(item?.day_of_month ?? 5));
  const [active, setActive] = useState(item?.active ?? true);

  function handleSave() {
    startTransition(async () => {
      const r = await saveRecurringExpense(
        item?.id ?? null,
        name,
        categoryId,
        Number(amount.replace(",", ".")),
        Number(day),
        active
      );
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Item salvo.");
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
              <Plus size={14} /> Novo item
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item recorrente" : "Novo item recorrente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Escolha…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor mensal (R$)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Dia do mês (1 a 28)</Label>
              <Input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
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

function MoveRecurringButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Mover para despesa? O item deixa de ser recorrente e não será mais lançado sozinho; as despesas já lançadas continuam.")) return;
        startTransition(async () => {
          const r = await moveRecurringToExpense(id);
          if (r?.error) toast.error(r.error);
          else {
            toast.success(r.message ?? "Movido.");
            router.refresh();
          }
        });
      }}
    >
      <ArrowRightLeft size={12} /> Mover
    </Button>
  );
}

export function RecurringPanel({ items, categories }: { items: RecurringExpense[]; categories: ExpenseCategory[] }) {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";
  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <RecurringDialog categories={categories} />
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="font-medium text-sm">
                {i.name}
                {!i.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {catName(i.category_id)} · {brl(i.amount)} · todo dia {i.day_of_month}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <MoveRecurringButton id={i.id} />
              <RecurringDialog item={i} categories={categories} />
              <DeleteButton action={() => deleteRecurringExpense(i.id)} />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item recorrente cadastrado.</p>}
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { createPurchase, type PurchaseLineInput } from "@/lib/actions/purchases-new";
import { isFixedAsset } from "@/lib/expense-allocation";
import type { ExpenseCategory, ExpenseSettings, Ingredient } from "@/lib/expense-model-types";

interface LineState {
  description: string;
  categoryId: string;
  ingredientId: string;
  quantity: string;
  amount: string;
  usefulLife: string;
  isAsset: boolean;
}

const emptyLine = (): LineState => ({
  description: "",
  categoryId: "",
  ingredientId: "",
  quantity: "1",
  amount: "",
  usefulLife: "",
  isAsset: false,
});

const num = (s: string) => Number(s.replace(",", "."));
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const selectClass = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export interface PurchaseFormInitial {
  date: string;
  supplier: string;
  docNumber: string;
  payment: string;
  notes: string;
  lines: Partial<LineState>[];
}

export function PurchaseForm({
  categories,
  ingredients,
  settings,
  today,
  initial,
  inboxId,
}: {
  categories: ExpenseCategory[];
  ingredients: Ingredient[];
  settings: ExpenseSettings;
  today: string;
  initial?: PurchaseFormInitial;
  inboxId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(initial?.date || today);
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [docNumber, setDocNumber] = useState(initial?.docNumber ?? "");
  const [payment, setPayment] = useState(initial?.payment || "pix");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<LineState[]>(
    initial && initial.lines.length > 0 ? initial.lines.map((l) => ({ ...emptyLine(), ...l })) : [emptyLine()]
  );

  const total = lines.reduce((s, l) => s + (num(l.amount) || 0), 0);

  function update(i: number, patch: Partial<LineState>) {
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        // Sugere ativo permanente quando valor e vida útil batem com a regra.
        if ("amount" in patch || "usefulLife" in patch || "quantity" in patch) {
          const unit = (num(next.amount) || 0) / (num(next.quantity) || 1);
          const life = next.usefulLife ? Number(next.usefulLife) : null;
          next.isAsset = isFixedAsset(unit, life, settings.asset_threshold, settings.asset_min_life_months);
        }
        return next;
      })
    );
  }

  function save() {
    const payload: PurchaseLineInput[] = lines.map((l) => ({
      description: l.description,
      categoryId: l.categoryId || null,
      ingredientId: l.ingredientId || null,
      quantity: num(l.quantity),
      amount: num(l.amount),
      usefulLifeMonths: l.usefulLife ? Number(l.usefulLife) : null,
      isAsset: l.isAsset,
    }));
    startTransition(async () => {
      const r = await createPurchase({
        date,
        supplierName: supplier,
        documentNumber: docNumber,
        paymentMethod: payment,
        notes,
        lines: payload,
        inboxId,
      });
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Compra lançada.");
        router.push(inboxId ? "/contabil/compras/caixa" : "/contabil/compras/relatorio");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Data da compra (= data do pagamento)</Label>
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fornecedor</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Número da nota (opcional)</Label>
          <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <select className={selectClass} value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao_debito">Cartão de débito</option>
            <option value="cartao_credito">Cartão de crédito</option>
            <option value="transferencia">Transferência</option>
            <option value="boleto">Boleto</option>
          </select>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="font-heading text-lg">Itens</h3>
        {lines.map((l, i) => {
          const cat = categories.find((c) => c.id === l.categoryId);
          return (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={l.description} onChange={(e) => update(i, { description: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <select
                    className={selectClass}
                    value={l.categoryId}
                    onChange={(e) => update(i, { categoryId: e.target.value, ingredientId: "" })}
                    disabled={l.isAsset}
                  >
                    <option value="">{l.isAsset ? "Ativo permanente" : "Escolha…"}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(cat?.rule === "alimentos" || cat?.rule === "bebidas") && !l.isAsset && (
                <div className="space-y-1">
                  <Label className="text-xs">Ingrediente / bebida usada em produto do bar (se for)</Label>
                  <select className={selectClass} value={l.ingredientId} onChange={(e) => update(i, { ingredientId: e.target.value })}>
                    <option value="">Não é ingrediente (vai 100% ao Café)</option>
                    {ingredients.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Bar {g.bar_pct}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade</Label>
                  <Input inputMode="decimal" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor total (R$)</Label>
                  <Input inputMode="decimal" value={l.amount} onChange={(e) => update(i, { amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vida útil (meses)</Label>
                  <Input type="number" min={1} value={l.usefulLife} onChange={(e) => update(i, { usefulLife: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={l.isAsset} onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, isAsset: e.target.checked } : x)))} />
                  Ativo permanente (não vai para a despesa do mês; sugerido se valor ≥ {brl(settings.asset_threshold)} e vida útil &gt; {settings.asset_min_life_months} meses)
                </label>
                {lines.length > 1 && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
          <Plus size={14} /> Adicionar item
        </Button>
      </section>

      <div className="space-y-1.5">
        <Label>Observações (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm">
          Total da nota: <strong>{brl(total)}</strong>
        </p>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Salvando..." : "Lançar compra"}
        </Button>
      </div>
    </div>
  );
}

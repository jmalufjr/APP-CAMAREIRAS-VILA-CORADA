"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { updatePurchase } from "@/lib/actions/purchase-edit";
import type { PurchaseRecord } from "@/lib/expense-model-types";

const selectClass = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";
const num = (s: string) => Number(s.replace(",", "."));

export function EditPurchaseDialog({
  purchase,
  categories,
  today,
}: {
  purchase: PurchaseRecord;
  categories: { id: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(purchase.date);
  const [supplier, setSupplier] = useState(purchase.supplier_name ?? "");
  const [docNumber, setDocNumber] = useState(purchase.document_number ?? "");
  const [payment, setPayment] = useState(purchase.payment_method ?? "pix");
  const [notes, setNotes] = useState(purchase.notes ?? "");
  const [lines, setLines] = useState(
    purchase.lines
      .filter((l) => !l.is_asset)
      .map((l) => ({ id: l.id, description: l.description, categoryId: l.category_id ?? "", quantity: String(l.quantity), amount: String(l.amount) }))
  );
  const isRecurring = purchase.source === "recorrente";

  function save() {
    startTransition(async () => {
      const r = await updatePurchase({
        purchaseId: purchase.id,
        date,
        supplierName: supplier,
        documentNumber: docNumber,
        paymentMethod: payment,
        notes,
        lines: lines.map((l) => ({
          id: l.id,
          description: l.description,
          categoryId: l.categoryId || null,
          quantity: num(l.quantity),
          amount: num(l.amount),
        })),
      });
      if (r?.error) toast.error(r.error);
      else {
        toast.success(r.message ?? "Despesa atualizada.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="xs">
            <Pencil size={12} /> Editar
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar despesa</DialogTitle>
          <DialogDescription>
            {isRecurring
              ? "Esta despesa é recorrente: ao salvar, o cadastro em “Itens recorrentes” também é atualizado (nome, categoria, valor e dia)."
              : "Edição permitida até 30 dias depois do fim do mês da despesa."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data da compra</Label>
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Número da nota</Label>
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
          {lines.map((l, i) => (
            <div key={l.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={l.description} onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <select className={selectClass} value={l.categoryId} onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, categoryId: e.target.value } : x)))}>
                    <option value="">Escolha…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade</Label>
                  <Input inputMode="decimal" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor total (R$)</Label>
                  <Input inputMode="decimal" value={l.amount} onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, amount: e.target.value } : x)))} />
                </div>
              </div>
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
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

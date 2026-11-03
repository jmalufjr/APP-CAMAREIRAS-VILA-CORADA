"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ParsedReceipt } from "@/lib/actions/receipt-ai";
import { createReceiptPurchase } from "@/lib/actions/receipt-purchase";
import type { ReceiptPurchaseInput } from "@/lib/actions/receipt-purchase";
import { compressImageForUpload } from "@/lib/image-compression";
import { isPendingPaymentMethod, SUPPLIER_PAYMENT_METHOD_LABELS, SUPPLIER_PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Save } from "lucide-react";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function formatBr(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

// Segundo card da tela "Lançar Compra": resumo (somente consulta) da nota lida pela IA — data,
// fornecedor, número e total no cabeçalho, uma linha por item (descrição, preço, quantidade) e
// uma caixa para marcar o que é do café da manhã. "Salvar" pede a forma de pagamento e grava a
// compra, deixando a IA enquadrar cada item num produto/bem cadastrado ou cadastrá-lo; "Inserir
// manualmente" abre o formulário completo. Nada aqui é editável além da caixa do café.
export function ReceiptSummaryCard({
  parsed,
  isReading,
  receiptFile,
  onManual,
  onSaved,
}: {
  parsed: ParsedReceipt | null;
  isReading: boolean;
  receiptFile: File | null;
  onManual: () => void;
  onSaved: () => void;
}) {
  const [breakfast, setBreakfast] = useState<Record<number, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const items = parsed?.items ?? [];
  const itemsTotal = items.reduce((s, i) => s + (i.subtotal || i.quantity * i.unit_cost), 0);
  const total = parsed?.total_amount && parsed.total_amount > 0 ? parsed.total_amount : itemsTotal;
  const noteDate = parsed?.date ?? null;
  const canSave = !!parsed && items.length > 0 && !isReading;

  function openSave() {
    setPaymentMethod(parsed?.payment_method ?? "");
    setDueDate("");
    setDialogOpen(true);
  }

  function submit() {
    if (!parsed) return;
    if (!paymentMethod) {
      toast.error("Escolha a forma de pagamento.");
      return;
    }
    if (isPendingPaymentMethod(paymentMethod) && !dueDate) {
      toast.error("Informe o vencimento — ele é obrigatório para cartão de crédito e a prazo.");
      return;
    }

    startTransition(async () => {
      const payload: ReceiptPurchaseInput = {
        date: noteDate ?? todayKey(),
        supplier_name: parsed.supplier_name,
        document_number: parsed.document_number,
        note_total: parsed.total_amount,
        payment_method: paymentMethod,
        due_date: isPendingPaymentMethod(paymentMethod) ? dueDate : null,
        confirm_duplicate: false,
        items: items.map((i, idx) => ({
          description: i.description,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          for_breakfast: i.kind === "produto" && !!breakfast[idx],
          kind: i.kind,
          matched_cost_item_id: i.matched_cost_item_id,
          matched_asset_catalog_item_id: i.matched_asset_catalog_item_id,
          suggested_category_id: i.suggested_category_id,
          suggested_name: i.suggested_name,
        })),
      };

      let preparedReceipt: { blob: Blob; filename: string } | null = null;
      if (receiptFile) {
        const isPdf = receiptFile.type === "application/pdf";
        const toUpload = isPdf ? receiptFile : await compressImageForUpload(receiptFile);
        preparedReceipt = { blob: toUpload, filename: isPdf ? "recibo.pdf" : "recibo.jpg" };
      }

      async function send(confirmDuplicate: boolean) {
        const formData = new FormData();
        formData.set("payload", JSON.stringify({ ...payload, confirm_duplicate: confirmDuplicate }));
        if (preparedReceipt) formData.set("receipt", preparedReceipt.blob, preparedReceipt.filename);
        return createReceiptPurchase(formData);
      }

      let result = await send(false);
      if (result && "duplicateWarning" in result && result.duplicateWarning) {
        if (!confirm(result.error)) return;
        result = await send(true);
      }
      if (!result || ("error" in result && result.error)) {
        toast.error((result && "error" in result && result.error) || "Erro ao registrar a compra.");
        return;
      }
      if (!("success" in result)) return;

      const saved = result as {
        createdProducts?: string[];
        createdAssets?: string[];
        createdSupplier?: string | null;
        photoError?: string;
        ledgerWarning?: string;
      };
      const extras: string[] = [];
      if ((saved.createdProducts?.length ?? 0) > 0) extras.push(`${saved.createdProducts!.length} produto(s) novo(s) cadastrado(s)`);
      if ((saved.createdAssets?.length ?? 0) > 0) extras.push(`${saved.createdAssets!.length} bem(ns) novo(s) no ativo permanente`);
      if (saved.createdSupplier) extras.push("fornecedor novo cadastrado");
      toast.success(`Compra registrada${extras.length ? ` — ${extras.join(", ")}` : ""}.`);
      if (saved.photoError) toast.error(`A compra foi salva, mas houve erro ao enviar a foto: ${saved.photoError}`);
      if (saved.ledgerWarning) toast.warning(`Atenção no lançamento contábil: ${saved.ledgerWarning}`);
      setDialogOpen(false);
      onSaved();
    });
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-heading text-lg">Resumo da nota</h3>

          {isReading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Lendo a nota…</p>
          ) : !parsed ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Escolha a foto ou o PDF da nota acima e clique em “Ler nota com IA”. O resumo da nota aparece aqui. Se
              preferir, use “Inserir manualmente”.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data da nota</p>
                  <p className="font-medium">{noteDate ? formatBr(noteDate) : `${formatBr(todayKey())} (não lida — usa hoje)`}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fornecedor</p>
                  <p className="font-medium">{parsed.supplier_name ?? "—"}</p>
                </div>
                {parsed.document_number && (
                  <div>
                    <p className="text-xs text-muted-foreground">Número da nota</p>
                    <p className="font-medium">{parsed.document_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Total da nota</p>
                  <p className="font-medium">{money(total)}</p>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  A nota foi lida, mas não trouxe itens detalhados (só o valor total). Use “Inserir manualmente” para lançar a
                  compra — ou “Lançar Despesa”, se for uma conta como luz ou honorários.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Descrição</th>
                        <th className="px-3 py-2 text-right font-medium">Preço</th>
                        <th className="px-3 py-2 text-right font-medium">Quantidade</th>
                        <th className="px-3 py-2 text-center font-medium">Café da manhã</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-3 py-2">{i.description}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{money(i.unit_cost)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {i.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Checkbox
                              checked={i.kind === "produto" && !!breakfast[idx]}
                              disabled={i.kind === "ativo"}
                              onCheckedChange={(c) => setBreakfast((prev) => ({ ...prev, [idx]: c === true }))}
                              aria-label={`${i.description}: item do café da manhã`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={openSave} disabled={!canSave}>
              <Save size={16} /> Salvar
            </Button>
            <Button variant="outline" onClick={onManual}>
              <Pencil size={16} /> Inserir manualmente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !isPending && setDialogOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forma de pagamento</DialogTitle>
            <DialogDescription>
              Como esta compra foi (ou será) paga? Ao confirmar, cada item é enquadrado num produto ou bem já cadastrado; o que
              não existir é cadastrado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {SUPPLIER_PAYMENT_METHOD_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                  paymentMethod === o.value ? "border-primary bg-accent" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={o.value}
                  checked={paymentMethod === o.value}
                  onChange={() => setPaymentMethod(o.value)}
                />
                <span className="flex-1">{SUPPLIER_PAYMENT_METHOD_LABELS[o.value]}</span>
              </label>
            ))}
            {isPendingPaymentMethod(paymentMethod) && (
              <div className="space-y-1.5 pt-1">
                <Label>Vencimento (obrigatório)</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">A compra fica pendente, em contas a pagar, até o pagamento ser registrado.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending ? "Salvando..." : "Confirmar e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

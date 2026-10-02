"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExpense } from "@/lib/actions/expenses";
import { parseReceiptWithAI } from "@/lib/actions/receipt-ai";
import { compressImageForUpload } from "@/lib/image-compression";
import type { ExpenseCategory } from "@/lib/types";
import type { InventoryItemWithBalance } from "@/lib/actions/inventory-items";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeScannerButton } from "@/components/shared/barcode-scanner";
import { Camera, Sparkles, Trash2, Plus, X } from "lucide-react";

interface ItemRow {
  description: string;
  quantity: number;
  unit_cost: number;
  inventory_item_id: string | null;
}

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// Formulário de lançamento de compra/despesa — compartilhado entre admin
// (`/compras/nova`) e funcionário de manutenção (`/manutencao/compras/nova`);
// a camareira nunca usa este componente (só registra baixa de estoque, ver
// PRD_compras.md seção 7.2). Foto da nota é opcional, assim como a leitura
// automática por IA — tudo pode ser preenchido manualmente se a IA não
// estiver configurada ou a leitura falhar.
export function ExpenseForm({
  categories,
  inventoryItems,
}: {
  categories: ExpenseCategory[];
  inventoryItems: InventoryItemWithBalance[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isReadingAI, setIsReadingAI] = useState(false);
  const router = useRouter();

  const [date, setDate] = useState(todayKey());
  const [categoryId, setCategoryId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [nfceUrl, setNfceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const total = items.length > 0 ? itemsTotal : Number(manualTotal || 0);

  function handlePickReceipt(file: File | null) {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleReadWithAI() {
    if (!receiptFile) {
      toast.error("Escolha uma foto da nota/recibo primeiro.");
      return;
    }
    setIsReadingAI(true);
    const formData = new FormData();
    formData.append("file", receiptFile);
    const result = await parseReceiptWithAI(formData);
    setIsReadingAI(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const data = result.data;
    if (data.supplier_name) setSupplierName(data.supplier_name);
    if (data.date) setDate(data.date);
    if (data.payment_method) setPaymentMethod(data.payment_method);
    if (data.items.length > 0) {
      setItems(
        data.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          inventory_item_id: null,
        }))
      );
    } else if (data.total_amount) {
      setManualTotal(String(data.total_amount));
    }
    toast.success("Nota lida — confira os dados antes de salvar.");
  }

  function addItemRow() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_cost: 0, inventory_item_id: null }]);
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleScanNfceQr(value: string) {
    setNfceUrl(value);
    toast.success("Código da nota lido — confira o link abaixo.");
  }

  function handleSubmit() {
    if (!categoryId) {
      toast.error("Selecione a categoria.");
      return;
    }
    if (total <= 0) {
      toast.error("Informe o valor total (ou os itens) da despesa.");
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      toast.error("Preencha a descrição de todos os itens, ou remova a linha vazia.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", date);
      formData.set("category_id", categoryId);
      formData.set("supplier_name", supplierName);
      formData.set("payment_method", paymentMethod);
      formData.set("nfce_url", nfceUrl);
      formData.set("notes", notes);
      formData.set("total_amount", String(total));
      formData.set(
        "items",
        JSON.stringify(
          items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
            subtotal: i.quantity * i.unit_cost,
            inventory_item_id: i.inventory_item_id,
          }))
        )
      );
      if (receiptFile) {
        const compressed = await compressImageForUpload(receiptFile);
        formData.set("receipt", compressed, "recibo.jpg");
      }

      const result = await createExpense(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result && "photoError" in result && result.photoError) {
        toast.error(`Despesa salva, mas houve erro ao enviar a foto: ${result.photoError}`);
      } else {
        toast.success("Despesa registrada.");
      }
      router.back();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-heading text-lg">Foto da nota/recibo (opcional)</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePickReceipt(e.target.files?.[0] ?? null)}
          />
          {receiptPreview && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptPreview} alt="Nota selecionada" className="h-32 rounded-lg object-cover border border-border" />
              <button
                type="button"
                className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 text-muted-foreground"
                onClick={() => handlePickReceipt(null)}
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} /> {receiptFile ? "Trocar foto" : "Tirar/escolher foto"}
            </Button>
            <Button type="button" variant="outline" onClick={handleReadWithAI} disabled={!receiptFile || isReadingAI}>
              <Sparkles size={16} /> {isReadingAI ? "Lendo..." : "Ler nota com IA"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A leitura automática preenche fornecedor, data, forma de pagamento e itens — confira tudo antes de salvar.
            Se não for possível ler, preencha os campos manualmente abaixo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a categoria">
                    {(v: string) => categories.find((c) => c.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor (opcional)</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nome da loja/fornecedor" />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione (opcional)">
                    {(v: string) => PAYMENT_METHOD_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Link/código da nota fiscal (opcional)</Label>
            <div className="flex gap-2">
              <Input
                value={nfceUrl}
                onChange={(e) => setNfceUrl(e.target.value)}
                placeholder="Cole o link, ou leia o QR code da nota"
              />
              <BarcodeScannerButton onScan={handleScanNfceQr} label="Ler QR" formats={["qr_code"]} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg">Itens (opcional)</h3>
            <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
              <Plus size={14} /> Adicionar item
            </Button>
          </div>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sem itens, informe só o valor total abaixo — útil pra despesas que não são compra de produtos (ex.: conta de
              luz, honorários).
            </p>
          )}

          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <Input
                  className="flex-1"
                  placeholder="Descrição do item"
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(index)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Quantidade</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Custo unitário (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_cost}
                    onChange={(e) => updateItem(index, { unit_cost: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Subtotal</Label>
                  <Input disabled value={`R$ ${(item.quantity * item.unit_cost).toFixed(2)}`} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vincular a item de estoque (opcional)</Label>
                <Select
                  value={item.inventory_item_id ?? "none"}
                  onValueChange={(v) => updateItem(index, { inventory_item_id: v === "none" ? null : (v ?? null) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Não controla estoque">
                      {(v: string) => inventoryItems.find((i) => i.id === v)?.name ?? "Não controla estoque"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não controla estoque</SelectItem>
                    {inventoryItems.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} (saldo: {i.balance} {i.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="space-y-1.5 max-w-xs">
              <Label>Valor total (R$)</Label>
              <Input type="number" min={0} step="0.01" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} />
            </div>
          )}

          {items.length > 0 && (
            <p className="text-sm font-medium">Total: R$ {itemsTotal.toFixed(2)}</p>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={isPending} size="lg" className="w-full sm:w-auto">
        {isPending ? "Salvando..." : "Salvar despesa"}
      </Button>
    </div>
  );
}

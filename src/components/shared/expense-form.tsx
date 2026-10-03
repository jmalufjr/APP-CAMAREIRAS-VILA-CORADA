"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import type { ExpenseWithItems } from "@/lib/actions/expenses";
import { parseReceiptWithAI } from "@/lib/actions/receipt-ai";
import { compressImageForUpload } from "@/lib/image-compression";
import type { ExpenseCategory, InventoryTurnoverGroup } from "@/lib/types";
import type { InventoryItemWithBalance } from "@/lib/actions/inventory-items";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BarcodeScannerButton } from "@/components/shared/barcode-scanner";
import { CameraCaptureButton } from "@/components/shared/camera-capture-button";
import { Sparkles, Trash2, Plus, X, FileText, FolderOpen } from "lucide-react";

interface ItemRow {
  description: string;
  quantity: number;
  unit_cost: number;
  inventory_item_id: string | null;
  // "Criar novo item de estoque" — a pessoa confirmou que esta linha deve
  // virar um item novo no catálogo (ver PRD_compras.md seção 16.6, sobre
  // evitar duplicidade com itens já cadastrados).
  createNew: boolean;
  newItemUnit: string;
  // Categoria de gasto deixou de ser um campo da compra inteira e passou
  // a existir só por item (Parte 19) — um item novo pode pertencer a mais
  // de uma categoria ao mesmo tempo.
  newItemCategoryIds: string[];
  newItemTurnoverGroupId: string; // "none" ou o id do grupo
}

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function emptyItem(): ItemRow {
  return {
    description: "",
    quantity: 1,
    unit_cost: 0,
    inventory_item_id: null,
    createNew: false,
    newItemUnit: "un",
    newItemCategoryIds: [],
    newItemTurnoverGroupId: "none",
  };
}

// Formulário de lançamento de compra/despesa — compartilhado entre admin
// ("Lançar Compra", menu principal) e funcionário de manutenção
// ("Lançar Compra", menu principal dele); a camareira nunca usa este
// componente (só registra baixa de estoque, ver PRD_compras.md seção
// 7.2). Foto/PDF da nota é opcional, assim como a leitura automática por
// IA — tudo pode ser preenchido manualmente se a IA não estiver
// configurada ou a leitura falhar.
export function ExpenseForm({
  categories,
  inventoryItems,
  turnoverGroups,
  mode = "create",
  expenseId,
  initial,
}: {
  categories: ExpenseCategory[];
  inventoryItems: InventoryItemWithBalance[];
  turnoverGroups: InventoryTurnoverGroup[];
  mode?: "create" | "edit";
  expenseId?: string;
  initial?: ExpenseWithItems;
}) {
  const [isPending, startTransition] = useTransition();
  const [isReadingAI, setIsReadingAI] = useState(false);
  const router = useRouter();

  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [supplierName, setSupplierName] = useState(initial?.supplier_name ?? "");
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.payment_method ?? "");
  const [nfceUrl, setNfceUrl] = useState(initial?.nfce_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [manualTotal, setManualTotal] = useState(
    initial && initial.items.length === 0 ? String(initial.total_amount) : ""
  );
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      inventory_item_id: i.inventory_item_id,
      createNew: false,
      newItemUnit: "un",
      newItemCategoryIds: [],
      newItemTurnoverGroupId: "none",
    })) ?? []
  );

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState(initial?.receipt_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inventoryCategories = categories.filter((c) => c.is_inventory_category);
  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const total = items.length > 0 ? itemsTotal : Number(manualTotal || 0);

  function handlePickReceipt(file: File | null) {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(file ? URL.createObjectURL(file) : null);
    if (file) setExistingReceiptUrl(null);
  }

  // Compara por nome exato (sem diferenciar maiúscula/minúscula) contra o
  // catálogo já cadastrado — se achar, pré-seleciona o vínculo em vez de
  // deixar "não controla estoque" por padrão. Nunca cria nada sozinho:
  // só sugere, a confirmação de criar um item novo continua sendo sempre
  // manual (ver PRD_compras.md seção 16.6).
  function matchExistingItem(description: string): InventoryItemWithBalance | undefined {
    const normalized = description.trim().toLowerCase();
    return inventoryItems.find((i) => i.name.trim().toLowerCase() === normalized);
  }

  async function handleReadWithAI() {
    if (!receiptFile) {
      toast.error("Escolha ou tire uma foto (ou PDF) da nota/recibo primeiro.");
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
    if (data.nfce_url) setNfceUrl(data.nfce_url);
    if (data.items.length > 0) {
      setItems(
        data.items.map((i) => {
          // A IA já tenta identificar o item contra o catálogo (até por
          // descrição diferente, ex.: marca) — o casamento por nome
          // exato é só um reforço pros casos em que ela não achou nada.
          const matchedId = i.matched_inventory_item_id ?? matchExistingItem(i.description)?.id ?? null;
          return {
            description: i.description,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
            inventory_item_id: matchedId,
            createNew: false,
            newItemUnit: "un",
            newItemCategoryIds: [],
            newItemTurnoverGroupId: "none",
          };
        })
      );
    } else if (data.total_amount) {
      setManualTotal(String(data.total_amount));
    }
    toast.success("Nota lida — confira os dados antes de salvar.");
  }

  function addItemRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleInventoryLinkChange(index: number, value: string) {
    if (value === "create_new") {
      updateItem(index, { createNew: true, inventory_item_id: null });
    } else if (value === "none") {
      updateItem(index, { createNew: false, inventory_item_id: null });
    } else {
      updateItem(index, { createNew: false, inventory_item_id: value });
    }
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleScanNfceQr(value: string) {
    setNfceUrl(value);
    toast.success("Código da nota lido — confira o link abaixo.");
  }

  function handleSubmit() {
    if (total <= 0) {
      toast.error("Informe o valor total (ou os itens) da despesa.");
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      toast.error("Preencha a descrição de todos os itens, ou remova a linha vazia.");
      return;
    }
    if (items.some((i) => i.createNew && i.newItemCategoryIds.length === 0)) {
      toast.error("Selecione ao menos uma categoria de gasto do novo item de estoque, em cada linha que for criar um.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", date);
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
            new_item: i.createNew
              ? {
                  category_ids: i.newItemCategoryIds,
                  unit: i.newItemUnit,
                  turnover_group_id: i.newItemTurnoverGroupId === "none" ? null : i.newItemTurnoverGroupId,
                }
              : null,
          }))
        )
      );
      if (receiptFile) {
        const isPdf = receiptFile.type === "application/pdf";
        const toUpload = isPdf ? receiptFile : await compressImageForUpload(receiptFile);
        formData.set("receipt", toUpload, isPdf ? "recibo.pdf" : "recibo.jpg");
      }

      const result = mode === "edit" && expenseId ? await updateExpense(expenseId, formData) : await createExpense(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result && "photoError" in result && result.photoError) {
        toast.error(`Despesa salva, mas houve erro ao enviar a foto: ${result.photoError}`);
      } else {
        toast.success(mode === "edit" ? "Despesa atualizada." : "Despesa registrada.");
      }
      router.back();
      router.refresh();
    });
  }

  const isPdfSelected = receiptFile?.type === "application/pdf";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-heading text-lg">Foto ou PDF da nota/recibo (opcional)</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handlePickReceipt(e.target.files?.[0] ?? null)}
          />
          {receiptPreview && !isPdfSelected && (
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
          {receiptFile && isPdfSelected && (
            <div className="relative inline-flex items-center gap-2 rounded-lg border border-border p-3">
              <FileText size={20} className="text-muted-foreground" />
              <span className="text-sm">{receiptFile.name}</span>
              <button
                type="button"
                className="rounded-full bg-background border border-border p-0.5 text-muted-foreground"
                onClick={() => handlePickReceipt(null)}
              >
                <X size={12} />
              </button>
            </div>
          )}
          {!receiptFile && existingReceiptUrl && (
            <p className="text-sm">
              <a href={existingReceiptUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Ver arquivo já anexado
              </a>{" "}
              <span className="text-muted-foreground">— escolha outro abaixo pra substituir.</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <CameraCaptureButton onCapture={handlePickReceipt} label="Tirar foto" />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen size={16} /> Escolher arquivo
            </Button>
            <Button type="button" variant="outline" onClick={handleReadWithAI} disabled={!receiptFile || isReadingAI}>
              <Sparkles size={16} /> {isReadingAI ? "Lendo..." : "Ler nota com IA"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A leitura automática preenche fornecedor, data, forma de pagamento e itens — confira tudo antes de salvar.
            Se não for possível ler, preencha os campos manualmente abaixo. Aceita foto ou PDF da nota.
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
                  value={item.createNew ? "create_new" : item.inventory_item_id ?? "none"}
                  onValueChange={(v) => v && handleInventoryLinkChange(index, v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Não controla estoque">
                      {(v: string) =>
                        v === "create_new"
                          ? "Criar novo item de estoque"
                          : inventoryItems.find((i) => i.id === v)?.name ?? "Não controla estoque"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não controla estoque</SelectItem>
                    <SelectItem value="create_new">+ Criar novo item de estoque</SelectItem>
                    {inventoryItems.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} (saldo: {i.balance} {i.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {item.createNew && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2">
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs text-muted-foreground">Categoria(s) de gasto do novo item</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {inventoryCategories.map((c) => (
                        <label key={c.id} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={item.newItemCategoryIds.includes(c.id)}
                            onCheckedChange={(checked) =>
                              updateItem(index, {
                                newItemCategoryIds:
                                  checked === true
                                    ? [...item.newItemCategoryIds, c.id]
                                    : item.newItemCategoryIds.filter((id) => id !== c.id),
                              })
                            }
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Unidade</Label>
                    <Input
                      value={item.newItemUnit}
                      onChange={(e) => updateItem(index, { newItemUnit: e.target.value })}
                      placeholder="un, kg, L..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Grupo de giro (opcional)</Label>
                    <Select
                      value={item.newItemTurnoverGroupId}
                      onValueChange={(v) => updateItem(index, { newItemTurnoverGroupId: v ?? "none" })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Nenhum">
                          {(v: string) => (v === "none" ? "Nenhum" : turnoverGroups.find((g) => g.id === v)?.name ?? v)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {turnoverGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
        {isPending ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Salvar despesa"}
      </Button>
    </div>
  );
}

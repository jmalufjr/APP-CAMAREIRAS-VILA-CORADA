"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import type { ExpenseWithItems } from "@/lib/actions/expenses";
import type { CostItemOption } from "@/lib/actions/cost-plan";
import { createSupplier } from "@/lib/actions/suppliers";
import type { SupplierOption } from "@/lib/actions/suppliers";
import { parseReceiptWithAI } from "@/lib/actions/receipt-ai";
import { compressImageForUpload } from "@/lib/image-compression";
import type { AssetCategory, CostCenter, FixedAssetCatalogItem } from "@/lib/types";
import { SUPPLIER_PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BarcodeScannerButton } from "@/components/shared/barcode-scanner";
import { CameraCaptureButton } from "@/components/shared/camera-capture-button";
import { Sparkles, Trash2, Plus, X, FileText, FolderOpen, ChevronDown, ChevronUp } from "lucide-react";

type LineType = "cost_item" | "new_cost_item" | "fixed_asset";

interface CenterLinkRow {
  center_id: string;
  alloc_pct: number;
}

interface ItemRow {
  description: string;
  quantity: number;
  unit_cost: number;
  // Desconto/frete/tributos (Módulo Contábil Leva 2) — campo colapsável,
  // só aparece quando a linha realmente tem algum desses valores.
  discount: number;
  freight: number;
  recoverableTax: number;
  nonRecoverableTax: number;
  showAdjustments: boolean;
  lineType: LineType;
  // target = "cost_item"
  costItemId: string;
  // target = "new_cost_item"
  newItemName: string;
  newItemIsInventory: boolean;
  newItemCenterLinks: CenterLinkRow[];
  // target = "fixed_asset" (bem novo)
  assetCategoryId: string;
  assetCatalogItemId: string; // "none" ou id
  assetBrand: string;
  assetModel: string;
  assetWarrantyUntil: string;
  assetLocation: string;
  assetNotes: string;
  // linha já ligada a um bem existente (edição) — nunca cria um bem novo
  existingFixedAssetId: string | null;
  existingFixedAssetName: string | null;
}

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function emptyItem(): ItemRow {
  return {
    description: "",
    quantity: 1,
    unit_cost: 0,
    discount: 0,
    freight: 0,
    recoverableTax: 0,
    nonRecoverableTax: 0,
    showAdjustments: false,
    lineType: "cost_item",
    costItemId: "",
    newItemName: "",
    newItemIsInventory: false,
    newItemCenterLinks: [],
    assetCategoryId: "",
    assetCatalogItemId: "none",
    assetBrand: "",
    assetModel: "",
    assetWarrantyUntil: "",
    assetLocation: "",
    assetNotes: "",
    existingFixedAssetId: null,
    existingFixedAssetName: null,
  };
}

// Custo líquido final de uma linha: quantidade×custo − desconto + frete
// + tributo NÃO recuperável. O tributo recuperável nunca entra aqui —
// representa crédito a recuperar depois, não um custo de verdade (ver
// PRD_compras&contabil.md seção 24).
function lineSubtotal(item: ItemRow): number {
  return item.quantity * item.unit_cost - item.discount + item.freight + item.nonRecoverableTax;
}

// Formulário de lançamento de compra/despesa — compartilhado entre admin
// ("Lançar compras e despesas", menu principal) e funcionário de
// manutenção ("Lançar Compra", menu principal dele); a camareira nunca
// usa este componente (só registra baixa de estoque, ver
// PRD_compras.md seção 7.2). Foto/PDF da nota é opcional, assim como a
// leitura automática por IA. Cada linha é alocada a um item de custo do
// Plano de Contas (existente ou novo) OU a um item de ativo permanente
// (bem novo) — nunca os dois ao mesmo tempo (PRD_compras.md seção 21).
// Desde o Módulo Contábil Leva 2, também gera o lançamento contábil
// automático (débito/crédito) por trás — sem nenhum campo novo pra isso
// aqui, é resolvido no servidor a partir da conta contábil de cada item.
export function ExpenseForm({
  costItemOptions,
  costCenters,
  assetCategories,
  assetCatalogItems,
  supplierOptions,
  mode = "create",
  expenseId,
  initial,
}: {
  costItemOptions: CostItemOption[];
  costCenters: CostCenter[];
  assetCategories: AssetCategory[];
  assetCatalogItems: FixedAssetCatalogItem[];
  supplierOptions: SupplierOption[];
  mode?: "create" | "edit";
  expenseId?: string;
  initial?: ExpenseWithItems;
}) {
  const [isPending, startTransition] = useTransition();
  const [isReadingAI, setIsReadingAI] = useState(false);
  const router = useRouter();

  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [competenceDate, setCompetenceDate] = useState(initial?.competence_date ?? "");
  const [documentNumber, setDocumentNumber] = useState(initial?.document_number ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.payment_method ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [nfceUrl, setNfceUrl] = useState(initial?.nfce_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [manualTotal, setManualTotal] = useState(
    initial && initial.items.length === 0 ? String(initial.total_amount) : ""
  );
  const [manualTotalCostItemId, setManualTotalCostItemId] = useState("");
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      discount: i.discount,
      freight: i.freight_and_other_costs,
      recoverableTax: i.recoverable_tax,
      nonRecoverableTax: i.non_recoverable_tax,
      showAdjustments: i.discount > 0 || i.freight_and_other_costs > 0 || i.recoverable_tax > 0 || i.non_recoverable_tax > 0,
      lineType: i.fixed_asset_id ? "fixed_asset" : "cost_item",
      costItemId: i.cost_item_id ?? "",
      newItemName: "",
      newItemIsInventory: false,
      newItemCenterLinks: [],
      assetCategoryId: "",
      assetCatalogItemId: "none",
      assetBrand: "",
      assetModel: "",
      assetWarrantyUntil: "",
      assetLocation: "",
      assetNotes: "",
      existingFixedAssetId: i.fixed_asset_id,
      existingFixedAssetName: i.fixed_asset_name,
    })) ?? []
  );

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState(initial?.receipt_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemsTotal = items.reduce((sum, i) => sum + lineSubtotal(i), 0);
  const total = items.length > 0 ? itemsTotal : Number(manualTotal || 0);

  function centerLabel(id: string): string {
    return costCenters.find((c) => c.id === id)?.name ?? id;
  }

  function handlePickReceipt(file: File | null) {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(file ? URL.createObjectURL(file) : null);
    if (file) setExistingReceiptUrl(null);
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
    if (data.supplier_name) {
      const match = supplierOptions.find((s) => s.name.toLowerCase() === data.supplier_name!.trim().toLowerCase());
      if (match) {
        setSupplierId(match.id);
      } else {
        setSupplierId("new");
        setNewSupplierName(data.supplier_name);
      }
    }
    if (data.date) setDate(data.date);
    if (data.document_number) setDocumentNumber(data.document_number);
    if (data.payment_method) setPaymentMethod(data.payment_method);
    if (data.nfce_url) setNfceUrl(data.nfce_url);
    if (data.items.length > 0) {
      setItems(
        data.items.map((i) => {
          const row = emptyItem();
          row.description = i.description;
          row.quantity = i.quantity;
          row.unit_cost = i.unit_cost;
          if (i.matched_inventory_item_id) {
            const matchedCostItem = costItemOptions.find((c) => c.inventory_item_id === i.matched_inventory_item_id);
            if (matchedCostItem) row.costItemId = matchedCostItem.id;
          }
          return row;
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

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addCenterLink(index: number) {
    const current = items[index].newItemCenterLinks;
    const firstOption = costCenters[0]?.id ?? "";
    updateItem(index, { newItemCenterLinks: [...current, { center_id: firstOption, alloc_pct: current.length === 0 ? 100 : 0 }] });
  }

  function updateCenterLink(index: number, linkIndex: number, patch: Partial<CenterLinkRow>) {
    const current = items[index].newItemCenterLinks;
    updateItem(index, {
      newItemCenterLinks: current.map((l, i) => (i === linkIndex ? { ...l, ...patch } : l)),
    });
  }

  function removeCenterLink(index: number, linkIndex: number) {
    const current = items[index].newItemCenterLinks;
    updateItem(index, { newItemCenterLinks: current.filter((_, i) => i !== linkIndex) });
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
    for (const i of items) {
      if (i.existingFixedAssetId) continue;
      if (i.lineType === "cost_item" && !i.costItemId) {
        toast.error("Selecione o item de custo de cada linha (ou escolha 'Criar novo item de custo'/'Ativo permanente').");
        return;
      }
      if (i.lineType === "new_cost_item") {
        if (!i.newItemName.trim()) {
          toast.error("Informe o nome do novo item de custo.");
          return;
        }
        if (i.newItemCenterLinks.length === 0) {
          toast.error("Ligue o novo item de custo a pelo menos 1 centro de custo.");
          return;
        }
        const sum = i.newItemCenterLinks.reduce((s, l) => s + l.alloc_pct, 0);
        if (sum !== 100) {
          toast.error(`Os percentuais dos centros do novo item de custo precisam somar 100% (soma atual: ${sum}%).`);
          return;
        }
      }
      if (i.lineType === "fixed_asset" && !i.assetCategoryId) {
        toast.error("Selecione a categoria do ativo permanente.");
        return;
      }
    }
    if (items.length === 0 && !manualTotalCostItemId) {
      toast.error("Selecione o item de custo do valor total.");
      return;
    }
    if (paymentMethod === "a_prazo" && !dueDate.trim()) {
      toast.error("Informe o vencimento — compra/despesa a prazo precisa de uma data de vencimento.");
      return;
    }
    if (supplierId === "new" && !newSupplierName.trim()) {
      toast.error("Informe o nome do novo fornecedor, ou selecione um existente na lista.");
      return;
    }

    startTransition(async () => {
      let resolvedSupplierId = supplierId === "new" || supplierId === "" ? null : supplierId;
      if (supplierId === "new") {
        const supplierResult = await createSupplier(newSupplierName, null, null, null, null);
        if (supplierResult.error || !supplierResult.id) {
          toast.error(supplierResult.error ?? "Erro ao criar fornecedor.");
          return;
        }
        resolvedSupplierId = supplierResult.id;
      }

      const itemsPayload =
        items.length === 0
          ? [
              {
                description: notes.trim() || "Despesa sem item detalhado",
                quantity: 1,
                unit_cost: total,
                subtotal: total,
                discount: 0,
                freight_and_other_costs: 0,
                recoverable_tax: 0,
                non_recoverable_tax: 0,
                cost_item_id: manualTotalCostItemId,
                new_cost_item: null,
                new_fixed_asset: null,
                existing_fixed_asset_id: null,
              },
            ]
          : items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unit_cost: i.unit_cost,
              subtotal: lineSubtotal(i),
              discount: i.discount,
              freight_and_other_costs: i.freight,
              recoverable_tax: i.recoverableTax,
              non_recoverable_tax: i.nonRecoverableTax,
              cost_item_id: i.existingFixedAssetId ? null : i.lineType === "cost_item" ? i.costItemId : null,
              new_cost_item:
                !i.existingFixedAssetId && i.lineType === "new_cost_item"
                  ? {
                      name: i.newItemName,
                      is_inventory: i.newItemIsInventory,
                      inventory_item_id: null,
                      center_links: i.newItemCenterLinks,
                    }
                  : null,
              new_fixed_asset:
                !i.existingFixedAssetId && i.lineType === "fixed_asset"
                  ? {
                      category_id: i.assetCategoryId,
                      catalog_item_id: i.assetCatalogItemId === "none" ? null : i.assetCatalogItemId,
                      brand: i.assetBrand.trim() || null,
                      model: i.assetModel.trim() || null,
                      warranty_until: i.assetWarrantyUntil || null,
                      location: i.assetLocation.trim() || null,
                      notes: i.assetNotes.trim() || null,
                    }
                  : null,
              existing_fixed_asset_id: i.existingFixedAssetId,
            }));

      let preparedReceipt: { blob: Blob; filename: string } | null = null;
      if (receiptFile) {
        const isPdf = receiptFile.type === "application/pdf";
        const toUpload = isPdf ? receiptFile : await compressImageForUpload(receiptFile);
        preparedReceipt = { blob: toUpload, filename: isPdf ? "recibo.pdf" : "recibo.jpg" };
      }

      async function doSubmit(confirmDuplicate: boolean) {
        const formData = new FormData();
        formData.set("date", date);
        formData.set("competence_date", competenceDate.trim() || date);
        formData.set("document_number", documentNumber.trim());
        if (resolvedSupplierId) formData.set("supplier_id", resolvedSupplierId);
        formData.set("payment_method", paymentMethod);
        if (paymentMethod === "a_prazo") formData.set("due_date", dueDate);
        formData.set("nfce_url", nfceUrl);
        formData.set("notes", notes);
        formData.set("total_amount", String(total));
        formData.set("items", JSON.stringify(itemsPayload));
        if (confirmDuplicate) formData.set("confirm_duplicate", "true");
        if (preparedReceipt) formData.set("receipt", preparedReceipt.blob, preparedReceipt.filename);
        return mode === "edit" && expenseId ? await updateExpense(expenseId, formData) : await createExpense(formData);
      }

      let result = await doSubmit(false);
      if (result && "duplicateWarning" in result && result.duplicateWarning) {
        if (!confirm(result.error)) return;
        result = await doSubmit(true);
      }

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
              <Label>Data de competência (opcional)</Label>
              <Input
                type="date"
                value={competenceDate}
                onChange={(e) => setCompetenceDate(e.target.value)}
                placeholder={date}
              />
              <p className="text-xs text-muted-foreground">Em branco, usa a mesma data acima.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor (opcional)</Label>
              <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : (v ?? ""))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum">
                    {(v: string) =>
                      v === "none"
                        ? "Nenhum"
                        : v === "new"
                          ? "Criar novo fornecedor"
                          : (supplierOptions.find((s) => s.id === v)?.name ?? v)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="new">+ Criar novo fornecedor</SelectItem>
                  {supplierOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supplierId === "new" && (
                <Input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Nome do novo fornecedor"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Número do documento (opcional)</Label>
              <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Nº da nota/cupom" />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione (opcional)">
                    {(v: string) => SUPPLIER_PAYMENT_METHOD_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentMethod === "a_prazo" && (
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
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
                  <Input disabled value={`R$ ${lineSubtotal(item).toFixed(2)}`} />
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => updateItem(index, { showAdjustments: !item.showAdjustments })}
              >
                {item.showAdjustments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Desconto, frete e tributos
              </Button>
              {item.showAdjustments && (
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Desconto (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.discount}
                      onChange={(e) => updateItem(index, { discount: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Frete e outros custos (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.freight}
                      onChange={(e) => updateItem(index, { freight: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tributo recuperável (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.recoverableTax}
                      onChange={(e) => updateItem(index, { recoverableTax: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tributo não recuperável (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.nonRecoverableTax}
                      onChange={(e) => updateItem(index, { nonRecoverableTax: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Desconto reduz o custo; frete e tributo não recuperável aumentam. Tributo recuperável é só registrado
                    (não muda o subtotal) — representa crédito a recuperar depois, não um custo.
                  </p>
                </div>
              )}

              {item.existingFixedAssetId ? (
                <div className="rounded-lg bg-muted/40 p-2 text-sm">
                  Ativo permanente vinculado: <strong>{item.existingFixedAssetName ?? "—"}</strong>
                  <p className="text-xs text-muted-foreground">
                    Pra editar categoria, marca, modelo etc., use a tela &quot;Relação de Ativo Permanente&quot;.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Alocar a</Label>
                    <Select value={item.lineType} onValueChange={(v) => v && updateItem(index, { lineType: v as LineType })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione">
                          {(v: string) =>
                            v === "cost_item"
                              ? "Item de custo existente"
                              : v === "new_cost_item"
                                ? "Criar novo item de custo"
                                : "Ativo permanente (bem novo)"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cost_item">Item de custo existente</SelectItem>
                        <SelectItem value="new_cost_item">+ Criar novo item de custo</SelectItem>
                        <SelectItem value="fixed_asset">Ativo permanente (bem novo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {item.lineType === "cost_item" && (
                    <Select value={item.costItemId} onValueChange={(v) => v && updateItem(index, { costItemId: v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o item de custo">
                          {(v: string) => costItemOptions.find((c) => c.id === v)?.name ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {costItemOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {item.lineType === "new_cost_item" && (
                    <div className="space-y-2 rounded-lg bg-muted/40 p-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome do novo item de custo</Label>
                        <Input
                          value={item.newItemName}
                          onChange={(e) => updateItem(index, { newItemName: e.target.value })}
                          placeholder={item.description || "Nome do item"}
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={item.newItemIsInventory}
                          onCheckedChange={(checked) => updateItem(index, { newItemIsInventory: checked === true })}
                        />
                        Representa um item de estoque (cria/liga um item no catálogo de estoque)
                      </label>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Centros de custo (os % precisam somar 100%)</Label>
                          <Button type="button" variant="ghost" size="sm" onClick={() => addCenterLink(index)}>
                            <Plus size={12} /> Centro
                          </Button>
                        </div>
                        {item.newItemCenterLinks.map((link, linkIndex) => (
                          <div key={linkIndex} className="flex items-center gap-2">
                            <Select
                              value={link.center_id}
                              onValueChange={(v) => v && updateCenterLink(index, linkIndex, { center_id: v })}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Centro de custo">
                                  {(v: string) => centerLabel(v)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {costCenters.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {centerLabel(c.id)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="w-20"
                              value={link.alloc_pct}
                              onChange={(e) => updateCenterLink(index, linkIndex, { alloc_pct: Number(e.target.value) || 0 })}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCenterLink(index, linkIndex)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.lineType === "fixed_asset" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Categoria</Label>
                        <Select
                          value={item.assetCategoryId}
                          onValueChange={(v) => v && updateItem(index, { assetCategoryId: v, assetCatalogItemId: "none" })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a categoria">
                              {(v: string) => assetCategories.find((c) => c.id === v)?.name ?? v}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {assetCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Item do catálogo (opcional)</Label>
                        <Select
                          value={item.assetCatalogItemId}
                          onValueChange={(v) => v && updateItem(index, { assetCatalogItemId: v })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Nenhum">
                              {(v: string) =>
                                v === "none" ? "Nenhum" : assetCatalogItems.find((c) => c.id === v)?.name ?? v
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {assetCatalogItems
                              .filter((c) => !item.assetCategoryId || c.category_id === item.assetCategoryId)
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Marca</Label>
                        <Input value={item.assetBrand} onChange={(e) => updateItem(index, { assetBrand: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Modelo</Label>
                        <Input value={item.assetModel} onChange={(e) => updateItem(index, { assetModel: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Garantia até (opcional)</Label>
                        <Input
                          type="date"
                          value={item.assetWarrantyUntil}
                          onChange={(e) => updateItem(index, { assetWarrantyUntil: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Local</Label>
                        <Input value={item.assetLocation} onChange={(e) => updateItem(index, { assetLocation: e.target.value })} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">Observações</Label>
                        <Textarea
                          rows={2}
                          value={item.assetNotes}
                          onChange={(e) => updateItem(index, { assetNotes: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1.5">
                <Label>Valor total (R$)</Label>
                <Input type="number" min={0} step="0.01" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Item de custo</Label>
                <Select value={manualTotalCostItemId} onValueChange={(v) => setManualTotalCostItemId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o item de custo">
                      {(v: string) => costItemOptions.find((c) => c.id === v)?.name ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {costItemOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

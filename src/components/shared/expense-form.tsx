"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import type { ExpenseWithItems } from "@/lib/actions/expenses";
import type { CostItemOption } from "@/lib/actions/cost-plan";
import type { CostSubcenterWithLinks } from "@/lib/actions/cost-plan";
import { parseReceiptWithAI } from "@/lib/actions/receipt-ai";
import { compressImageForUpload } from "@/lib/image-compression";
import type { AssetCategory, FixedAssetCatalogItem } from "@/lib/types";
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

type LineType = "cost_item" | "new_cost_item" | "fixed_asset";

interface SubcenterLinkRow {
  subcenter_id: string;
  alloc_pct: number;
}

interface ItemRow {
  description: string;
  quantity: number;
  unit_cost: number;
  lineType: LineType;
  // target = "cost_item"
  costItemId: string;
  // target = "new_cost_item"
  newItemName: string;
  newItemIsInventory: boolean;
  newItemSubcenterLinks: SubcenterLinkRow[];
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
    lineType: "cost_item",
    costItemId: "",
    newItemName: "",
    newItemIsInventory: false,
    newItemSubcenterLinks: [],
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

// Formulário de lançamento de compra/despesa — compartilhado entre admin
// ("Lançar compras e despesas", menu principal) e funcionário de
// manutenção ("Lançar Compra", menu principal dele); a camareira nunca
// usa este componente (só registra baixa de estoque, ver
// PRD_compras.md seção 7.2). Foto/PDF da nota é opcional, assim como a
// leitura automática por IA. Cada linha é alocada a um item de custo do
// Plano de Contas (existente ou novo) OU a um item de ativo permanente
// (bem novo) — nunca os dois ao mesmo tempo (PRD_compras.md seção 21).
export function ExpenseForm({
  costItemOptions,
  costSubcenters,
  assetCategories,
  assetCatalogItems,
  mode = "create",
  expenseId,
  initial,
}: {
  costItemOptions: CostItemOption[];
  costSubcenters: CostSubcenterWithLinks[];
  assetCategories: AssetCategory[];
  assetCatalogItems: FixedAssetCatalogItem[];
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
  const [manualTotalCostItemId, setManualTotalCostItemId] = useState("");
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      lineType: i.fixed_asset_id ? "fixed_asset" : "cost_item",
      costItemId: i.cost_item_id ?? "",
      newItemName: "",
      newItemIsInventory: false,
      newItemSubcenterLinks: [],
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

  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const total = items.length > 0 ? itemsTotal : Number(manualTotal || 0);

  function subcenterLabel(id: string): string {
    const s = costSubcenters.find((s) => s.id === id);
    if (!s) return id;
    const centers = s.centers.map((c) => c.center_name).join("/");
    return centers ? `${s.name} (${centers})` : s.name;
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
    if (data.supplier_name) setSupplierName(data.supplier_name);
    if (data.date) setDate(data.date);
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

  function addSubcenterLink(index: number) {
    const current = items[index].newItemSubcenterLinks;
    const firstOption = costSubcenters[0]?.id ?? "";
    updateItem(index, { newItemSubcenterLinks: [...current, { subcenter_id: firstOption, alloc_pct: current.length === 0 ? 100 : 0 }] });
  }

  function updateSubcenterLink(index: number, linkIndex: number, patch: Partial<SubcenterLinkRow>) {
    const current = items[index].newItemSubcenterLinks;
    updateItem(index, {
      newItemSubcenterLinks: current.map((l, i) => (i === linkIndex ? { ...l, ...patch } : l)),
    });
  }

  function removeSubcenterLink(index: number, linkIndex: number) {
    const current = items[index].newItemSubcenterLinks;
    updateItem(index, { newItemSubcenterLinks: current.filter((_, i) => i !== linkIndex) });
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
        if (i.newItemSubcenterLinks.length === 0) {
          toast.error("Ligue o novo item de custo a pelo menos 1 subcentro.");
          return;
        }
        const sum = i.newItemSubcenterLinks.reduce((s, l) => s + l.alloc_pct, 0);
        if (sum !== 100) {
          toast.error(`Os percentuais dos subcentros do novo item de custo precisam somar 100% (soma atual: ${sum}%).`);
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

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", date);
      formData.set("supplier_name", supplierName);
      formData.set("payment_method", paymentMethod);
      formData.set("nfce_url", nfceUrl);
      formData.set("notes", notes);
      formData.set("total_amount", String(total));
      const itemsPayload =
        items.length === 0
          ? [
              {
                description: supplierName.trim() || "Despesa sem item detalhado",
                quantity: 1,
                unit_cost: total,
                subtotal: total,
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
              subtotal: i.quantity * i.unit_cost,
              cost_item_id: i.existingFixedAssetId ? null : i.lineType === "cost_item" ? i.costItemId : null,
              new_cost_item:
                !i.existingFixedAssetId && i.lineType === "new_cost_item"
                  ? {
                      name: i.newItemName,
                      is_inventory: i.newItemIsInventory,
                      inventory_item_id: null,
                      subcenter_links: i.newItemSubcenterLinks,
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
      formData.set("items", JSON.stringify(itemsPayload));
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
                          <Label className="text-xs text-muted-foreground">Subcentros (os % precisam somar 100%)</Label>
                          <Button type="button" variant="ghost" size="sm" onClick={() => addSubcenterLink(index)}>
                            <Plus size={12} /> Subcentro
                          </Button>
                        </div>
                        {item.newItemSubcenterLinks.map((link, linkIndex) => (
                          <div key={linkIndex} className="flex items-center gap-2">
                            <Select
                              value={link.subcenter_id}
                              onValueChange={(v) => v && updateSubcenterLink(index, linkIndex, { subcenter_id: v })}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Subcentro">
                                  {(v: string) => subcenterLabel(v)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {costSubcenters.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {subcenterLabel(s.id)}
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
                              onChange={(e) => updateSubcenterLink(index, linkIndex, { alloc_pct: Number(e.target.value) || 0 })}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSubcenterLink(index, linkIndex)}>
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

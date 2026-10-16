"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProduct, updateProduct, deleteProduct } from "@/lib/actions/products";
import type { ProductRow } from "@/lib/actions/products";
import type { CostCenter, LedgerAccount, ProductCategory, ProductType, UnitConversion } from "@/lib/types";
import { COMMON_UNITS, PRODUCT_TYPE_OPTIONS } from "@/lib/units";
import { PctLinksEditor, type LinkRow } from "@/components/shared/pct-links-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  centers: { center_id: string; center_name: string; alloc_pct: number }[];
}

// Cadastro de produtos (PRD 5.1) — cria/edita, de uma vez, o item de
// custo e (se controla estoque) o item de estoque ligado a ele.
export function ProductDialog({
  product,
  categories,
  centers,
  ledgerAccounts,
  candidates,
}: {
  product?: ProductRow;
  categories: ProductCategory[];
  centers: CostCenter[];
  ledgerAccounts: LedgerAccount[];
  candidates: Candidate[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!product;

  const [promoteFromId, setPromoteFromId] = useState("none");
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "none");
  const [productType, setProductType] = useState<string>(product?.product_type ?? "none");
  const [active, setActive] = useState(product?.active ?? true);
  const [ledgerCode, setLedgerCode] = useState(product?.ledger_account_code ?? "auto");
  const [links, setLinks] = useState<LinkRow[]>(product?.centers.map((c) => ({ id: c.center_id, pct: c.alloc_pct })) ?? []);
  const [controlsStock, setControlsStock] = useState(product?.controls_stock ?? true);
  const [unit, setUnit] = useState(product?.unit ?? "un");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [reorderPoint, setReorderPoint] = useState(String(product?.reorder_point ?? 0));
  const [isPerishable, setIsPerishable] = useState(product?.is_perishable ?? false);
  const [shelfLife, setShelfLife] = useState(product?.shelf_life_days ? String(product.shelf_life_days) : "");
  const [alertDays, setAlertDays] = useState(String(product?.expiry_alert_days ?? 7));
  const [conversions, setConversions] = useState<{ unit_name: string; factor: string }[]>(
    product?.conversions.map((c) => ({ unit_name: c.unit_name, factor: String(c.factor) })) ?? []
  );

  const unitLocked = !!product?.has_history && controlsStock && !!product?.controls_stock;
  const centerOptions = centers.map((c) => ({ id: c.id, label: c.name }));

  function applyCandidate(id: string) {
    setPromoteFromId(id);
    const c = candidates.find((x) => x.id === id);
    if (c) {
      setName(c.name);
      setLinks(c.centers.map((l) => ({ id: l.center_id, pct: l.alloc_pct })));
    }
  }

  function handleSave() {
    const convs: UnitConversion[] = conversions
      .filter((c) => c.unit_name.trim() || c.factor.trim())
      .map((c) => ({ unit_name: c.unit_name.trim(), factor: Number(c.factor.replace(",", ".")) }));
    startTransition(async () => {
      const input = {
        name,
        sku: sku || null,
        description: description || null,
        categoryId: categoryId === "none" ? null : categoryId,
        productType: productType === "none" ? null : (productType as ProductType),
        active,
        ledgerAccountCode: ledgerCode === "auto" ? null : ledgerCode,
        centerLinks: links.map((l) => ({ center_id: l.id, alloc_pct: l.pct })),
        controlsStock,
        unit,
        barcode: barcode || null,
        conversions: convs,
        reorderPoint: Number(reorderPoint.replace(",", ".")) || 0,
        shelfLifeDays: shelfLife.trim() ? Number(shelfLife) : null,
        expiryAlertDays: Number(alertDays) || 0,
        isPerishable,
        promoteFromId: !isEdit && promoteFromId !== "none" ? promoteFromId : null,
      };
      const result = isEdit ? await updateProduct(product.id, input) : await createProduct(input);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Produto salvo.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!product || !confirm("Excluir este produto? Essa ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Produto excluído.");
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
              <Plus size={14} /> Novo produto
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && candidates.length > 0 && (
            <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
              <Label className="text-xs text-muted-foreground">Começar de um item de custo que já existe (opcional)</Label>
              <Select value={promoteFromId} onValueChange={(v) => v && applyCandidate(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => (v === "none" ? "Criar do zero" : (candidates.find((c) => c.id === v)?.name ?? v))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Criar do zero</SelectItem>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código interno / SKU (opcional)</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Código de barras (opcional)</Label>
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={!controlsStock} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => (v === "none" ? "Sem categoria" : (categories.find((c) => c.id === v)?.name ?? v))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories
                    .filter((c) => c.active || c.id === product?.category_id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={productType} onValueChange={(v) => v && setProductType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => (v === "none" ? "Não classificado" : (PRODUCT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não classificado</SelectItem>
                  {PRODUCT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativo
            </label>
          )}

          <PctLinksEditor options={centerOptions} value={links} onChange={setLinks} />

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={controlsStock} onCheckedChange={(c) => setControlsStock(c === true)} />
            Controla estoque
          </label>
          {controlsStock && (
            <div className="space-y-3 rounded-lg bg-muted/40 p-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Unidade-base</Label>
                  <Input list="unidades-comuns" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={unitLocked} />
                  <datalist id="unidades-comuns">
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                  {unitLocked && <p className="text-xs text-muted-foreground">Tem histórico — a unidade-base não muda.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estoque mínimo</Label>
                  <Input type="number" min={0} step="0.001" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Conversões de unidade (ex.: 1 garrafa = 0,75 {unit || "unidade-base"})
                  </Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConversions([...conversions, { unit_name: "", factor: "" }])}>
                    <Plus size={12} /> Unidade
                  </Button>
                </div>
                {conversions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">1</span>
                    <Input
                      className="flex-1"
                      placeholder="garrafa"
                      value={c.unit_name}
                      onChange={(e) => setConversions(conversions.map((x, j) => (j === i ? { ...x, unit_name: e.target.value } : x)))}
                    />
                    <span className="text-xs text-muted-foreground">=</span>
                    <Input
                      className="w-24"
                      type="number"
                      min={0}
                      step="0.000001"
                      value={c.factor}
                      onChange={(e) => setConversions(conversions.map((x, j) => (j === i ? { ...x, factor: e.target.value } : x)))}
                    />
                    <span className="text-xs text-muted-foreground">{unit}</span>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConversions(conversions.filter((_, j) => j !== i))}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Com a unidade-base L, ml já é entendido sozinho (e g com kg) — só cadastre as demais.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isPerishable} onCheckedChange={(c) => setIsPerishable(c === true)} />
                Perecível (custo do café da manhã)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prazo de validade (dias, opcional)</Label>
                  <Input type="number" min={1} value={shelfLife} onChange={(e) => setShelfLife(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Avisar quantos dias antes de vencer</Label>
                  <Input type="number" min={0} value={alertDays} onChange={(e) => setAlertDays(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Conta contábil (opcional — usa um padrão automático se não escolher)</Label>
            <Select value={ledgerCode} onValueChange={(v) => v && setLedgerCode(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => (v === "auto" ? "Padrão automático" : (ledgerAccounts.find((a) => a.code === v)?.name ?? v))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Padrão automático</SelectItem>
                {ledgerAccounts
                  .filter((a) => a.active && (a.account_group === "custo" || a.account_group === "despesa"))
                  .map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.display_code ? `${a.display_code} — ${a.name}` : a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          {isEdit && !product.has_history && (
            <Button variant="outline" onClick={handleDelete} disabled={isPending}>
              Excluir
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

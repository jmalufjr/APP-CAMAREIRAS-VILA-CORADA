"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCostItem,
  updateCostItem,
  deleteCostItem,
  createCostSubcenter,
  updateCostSubcenter,
  deleteCostSubcenter,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
} from "@/lib/actions/cost-plan";
import type { CostItemWithLinks, CostSubcenterWithLinks } from "@/lib/actions/cost-plan";
import type { CostCenter } from "@/lib/types";
import type { InventoryItemWithBalance } from "@/lib/actions/inventory-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface LinkRow {
  id: string;
  pct: number;
}

function sumPct(links: LinkRow[]): number {
  return links.reduce((s, l) => s + l.pct, 0);
}

// Editor genérico de vínculos N-N com percentual (item→subcentro ou
// subcentro→centro) — os % precisam somar exatamente 100%.
function PctLinksEditor({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: LinkRow[];
  onChange: (next: LinkRow[]) => void;
}) {
  function add() {
    const used = new Set(value.map((v) => v.id));
    const next = options.find((o) => !used.has(o.id)) ?? options[0];
    if (!next) return;
    onChange([...value, { id: next.id, pct: value.length === 0 ? 100 : 0 }]);
  }
  function update(index: number, patch: Partial<LinkRow>) {
    onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const sum = sumPct(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          Vínculos (% precisam somar 100% — soma atual: {sum}%)
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={add} disabled={value.length >= options.length}>
          <Plus size={12} /> Vínculo
        </Button>
      </div>
      {value.map((link, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select value={link.id} onValueChange={(v) => v && update(index, { id: v })}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione">
                {(v: string) => options.find((o) => o.id === v)?.label ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            max={100}
            className="w-20"
            value={link.pct}
            onChange={(e) => update(index, { pct: Number(e.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
            <Trash2 size={12} />
          </Button>
        </div>
      ))}
      {value.length === 0 && <p className="text-xs text-muted-foreground">Nenhum vínculo ainda.</p>}
    </div>
  );
}

export function CostPlanPanel({
  items,
  subcenters,
  centers,
  inventoryItems,
}: {
  items: CostItemWithLinks[];
  subcenters: CostSubcenterWithLinks[];
  centers: CostCenter[];
  inventoryItems: InventoryItemWithBalance[];
}) {
  const subcenterOptions = subcenters.map((s) => ({ id: s.id, label: s.name }));
  const centerOptions = centers.map((c) => ({ id: c.id, label: c.name }));
  const usedInventoryItemIds = new Set(items.filter((i) => i.inventory_item_id).map((i) => i.inventory_item_id as string));
  const availableInventoryItems = inventoryItems.filter((i) => !usedInventoryItemIds.has(i.id));

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg">Itens de custo</h3>
          <CostItemDialog subcenterOptions={subcenterOptions} availableInventoryItems={availableInventoryItems} />
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">
                    {item.name}
                    {item.is_inventory && <span className="ml-1.5 text-xs text-muted-foreground">(estoque)</span>}
                    {!item.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.subcenters.length > 0
                      ? item.subcenters.map((s) => `${s.subcenter_name} (${s.center_name}) ${s.alloc_pct}%`).join(" · ")
                      : "Sem subcentro vinculado"}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <CostItemDialog item={item} subcenterOptions={subcenterOptions} availableInventoryItems={availableInventoryItems} />
                  <DeleteButton action={() => deleteCostItem(item.id)} />
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item cadastrado.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg">Subcentros de custo</h3>
          <CostSubcenterDialog centerOptions={centerOptions} />
        </div>
        <div className="space-y-2">
          {subcenters.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">
                    {s.name}
                    {!s.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.centers.map((c) => `${c.center_name} ${c.alloc_pct}%`).join(" · ") || "Sem centro vinculado"}
                    {s.count_frequency_days !== null && ` · contagem a cada ${s.count_frequency_days} dia(s)`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <CostSubcenterDialog subcenter={s} centerOptions={centerOptions} />
                  <DeleteButton action={() => deleteCostSubcenter(s.id)} />
                </div>
              </div>
            </div>
          ))}
          {subcenters.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum subcentro cadastrado.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg">Centros de custo</h3>
          <CostCenterDialog />
        </div>
        <div className="space-y-2">
          {centers.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <p className="font-medium text-sm">
                {c.name}
                {!c.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
              </p>
              <div className="flex gap-1 shrink-0">
                <CostCenterDialog center={c} />
                <DeleteButton action={() => deleteCostCenter(c.id)} />
              </div>
            </div>
          ))}
          {centers.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum centro cadastrado.</p>}
        </div>
      </section>
    </div>
  );
}

function DeleteButton({ action }: { action: () => Promise<{ error?: string }> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Tem certeza? Essa ação não pode ser desfeita.")) return;
        startTransition(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
          else {
            toast.success("Removido.");
            router.refresh();
          }
        });
      }}
    >
      <Trash2 size={14} />
    </Button>
  );
}

function CostItemDialog({
  item,
  subcenterOptions,
  availableInventoryItems,
}: {
  item?: CostItemWithLinks;
  subcenterOptions: { id: string; label: string }[];
  availableInventoryItems: InventoryItemWithBalance[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [isInventory, setIsInventory] = useState(item?.is_inventory ?? false);
  const [inventoryItemId, setInventoryItemId] = useState("new");
  const [newInventoryItemName, setNewInventoryItemName] = useState("");
  const [links, setLinks] = useState<LinkRow[]>(item?.subcenters.map((s) => ({ id: s.subcenter_id, pct: s.alloc_pct })) ?? []);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    startTransition(async () => {
      const subcenterLinks = links.map((l) => ({ subcenter_id: l.id, alloc_pct: l.pct }));
      const result = isEdit
        ? await updateCostItem(item.id, name, active, subcenterLinks)
        : await createCostItem(
            name,
            isInventory,
            isInventory && inventoryItemId !== "new" ? inventoryItemId : null,
            isInventory && inventoryItemId === "new" ? newInventoryItemName : null,
            subcenterLinks
          );
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Item de custo salvo.");
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
              <Plus size={14} /> Novo item de custo
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item de custo" : "Novo item de custo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativo
            </label>
          )}
          {!isEdit && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isInventory} onCheckedChange={(c) => setIsInventory(c === true)} />
                Representa um item de estoque
              </label>
              {isInventory && (
                <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
                  <Label className="text-xs text-muted-foreground">Item de estoque</Label>
                  <Select value={inventoryItemId} onValueChange={(v) => v && setInventoryItemId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(v: string) =>
                          v === "new" ? "Criar novo item de estoque" : availableInventoryItems.find((i) => i.id === v)?.name ?? v
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">+ Criar novo item de estoque</SelectItem>
                      {availableInventoryItems.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {inventoryItemId === "new" && (
                    <Input
                      value={newInventoryItemName}
                      onChange={(e) => setNewInventoryItemName(e.target.value)}
                      placeholder={name || "Nome do novo item de estoque"}
                    />
                  )}
                </div>
              )}
            </>
          )}
          <PctLinksEditor options={subcenterOptions} value={links} onChange={setLinks} />
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

function CostSubcenterDialog({
  subcenter,
  centerOptions,
}: {
  subcenter?: CostSubcenterWithLinks;
  centerOptions: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!subcenter;

  const [name, setName] = useState(subcenter?.name ?? "");
  const [active, setActive] = useState(subcenter?.active ?? true);
  const [countFrequencyDays, setCountFrequencyDays] = useState(
    subcenter?.count_frequency_days !== undefined && subcenter?.count_frequency_days !== null
      ? String(subcenter.count_frequency_days)
      : ""
  );
  const [links, setLinks] = useState<LinkRow[]>(subcenter?.centers.map((c) => ({ id: c.center_id, pct: c.alloc_pct })) ?? []);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    const days = countFrequencyDays.trim() ? Number(countFrequencyDays) : null;
    startTransition(async () => {
      const centerLinks = links.map((l) => ({ center_id: l.id, alloc_pct: l.pct }));
      const result = isEdit
        ? await updateCostSubcenter(subcenter.id, name, active, days, centerLinks)
        : await createCostSubcenter(name, days, centerLinks);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Subcentro salvo.");
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
              <Plus size={14} /> Novo subcentro
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar subcentro" : "Novo subcentro de custo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Frequência de contagem física (dias, opcional)</Label>
            <Input type="number" min={1} value={countFrequencyDays} onChange={(e) => setCountFrequencyDays(e.target.value)} />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativo
            </label>
          )}
          <PctLinksEditor options={centerOptions} value={links} onChange={setLinks} />
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

function CostCenterDialog({ center }: { center?: CostCenter }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!center;

  const [name, setName] = useState(center?.name ?? "");
  const [active, setActive] = useState(center?.active ?? true);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    startTransition(async () => {
      const result = isEdit ? await updateCostCenter(center.id, name, active) : await createCostCenter(name);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Centro salvo.");
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
              <Plus size={14} /> Novo centro
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar centro de custo" : "Novo centro de custo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
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

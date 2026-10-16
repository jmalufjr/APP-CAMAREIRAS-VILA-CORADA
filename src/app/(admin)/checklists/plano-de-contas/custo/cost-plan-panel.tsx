"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCostItem,
  updateCostItem,
  deleteCostItem,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
} from "@/lib/actions/cost-plan";
import type { CostItemWithLinks } from "@/lib/actions/cost-plan";
import type { CostCenter, LedgerAccount } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PctLinksEditor, type LinkRow } from "@/components/shared/pct-links-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function CostPlanPanel({
  items,
  centers,
  ledgerAccounts,
}: {
  items: CostItemWithLinks[];
  centers: CostCenter[];
  ledgerAccounts: LedgerAccount[];
}) {
  const centerOptions = centers.map((c) => ({ id: c.id, label: c.name }));
  const ledgerAccountById = new Map(ledgerAccounts.map((a) => [a.code, a]));

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg">Itens de custo</h3>
          <CostItemDialog centerOptions={centerOptions} ledgerAccounts={ledgerAccounts} />
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">
                    {item.name}
                    {item.is_product && <span className="ml-1.5 text-xs text-muted-foreground">(produto)</span>}
                    {!item.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.centers.length > 0
                      ? item.centers.map((c) => `${c.center_name} ${c.alloc_pct}%`).join(" · ")
                      : "Sem centro vinculado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conta contábil:{" "}
                    {item.ledger_account_code
                      ? (ledgerAccountById.get(item.ledger_account_code)?.name ?? item.ledger_account_code)
                      : "Padrão automático"}
                  </p>
                </div>
                {item.is_product ? (
                  <Link href="/contabil/produtos" className="shrink-0 text-xs text-primary hover:underline">
                    Editar no Cadastro de produtos
                  </Link>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <CostItemDialog item={item} centerOptions={centerOptions} ledgerAccounts={ledgerAccounts} />
                    <DeleteButton action={() => deleteCostItem(item.id)} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item cadastrado.</p>}
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
              <div>
                <p className="font-medium text-sm">
                  {c.name}
                  {!c.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
                </p>
                {c.count_frequency_days !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">contagem a cada {c.count_frequency_days} dia(s)</p>
                )}
              </div>
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
  centerOptions,
  ledgerAccounts,
}: {
  item?: CostItemWithLinks;
  centerOptions: { id: string; label: string }[];
  ledgerAccounts: LedgerAccount[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [links, setLinks] = useState<LinkRow[]>(item?.centers.map((c) => ({ id: c.center_id, pct: c.alloc_pct })) ?? []);
  const [ledgerAccountCode, setLedgerAccountCode] = useState(item?.ledger_account_code ?? "auto");

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    startTransition(async () => {
      const centerLinks = links.map((l) => ({ center_id: l.id, alloc_pct: l.pct }));
      const resolvedLedgerAccountCode = ledgerAccountCode === "auto" ? null : ledgerAccountCode;
      const result = isEdit
        ? await updateCostItem(item.id, name, active, false, null, null, centerLinks, resolvedLedgerAccountCode)
        : await createCostItem(name, false, null, null, centerLinks, resolvedLedgerAccountCode);
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
          <p className="text-xs text-muted-foreground">
            Este cadastro é pra gastos que não são produtos (salário, luz, honorários). Produtos — com ou sem
            estoque — são criados e editados em Módulo Contábil → Cadastro de produtos.
          </p>
          <PctLinksEditor options={centerOptions} value={links} onChange={setLinks} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Conta contábil (Módulo Contábil — opcional, usa um padrão automático se não escolher)
            </Label>
            <Select value={ledgerAccountCode} onValueChange={(v) => v && setLedgerAccountCode(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione">
                  {(v: string) => (v === "auto" ? "Padrão automático" : ledgerAccounts.find((a) => a.code === v)?.name ?? v)}
                </SelectValue>
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
  const [countFrequencyDays, setCountFrequencyDays] = useState(
    center?.count_frequency_days !== undefined && center?.count_frequency_days !== null ? String(center.count_frequency_days) : ""
  );

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    startTransition(async () => {
      const days = countFrequencyDays.trim() ? Number(countFrequencyDays) : null;
      const result = isEdit ? await updateCostCenter(center.id, name, active, days) : await createCostCenter(name);
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
            <>
              <div className="space-y-1.5">
                <Label>Frequência de contagem física (dias, opcional)</Label>
                <Input type="number" min={1} value={countFrequencyDays} onChange={(e) => setCountFrequencyDays(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={active} onCheckedChange={setActive} /> Ativo
              </label>
            </>
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

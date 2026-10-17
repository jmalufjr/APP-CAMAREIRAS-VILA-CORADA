"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { createCostItem, updateCostItem, deleteCostItem } from "@/lib/actions/cost-plan";
import type { CostItemWithLinks } from "@/lib/actions/cost-plan";
import type { LedgerAccount } from "@/lib/types";
import { PctLinksEditor, type LinkRow } from "@/components/shared/pct-links-editor";
import { DeleteButton } from "@/components/shared/delete-button";

export function CostItemDialog({
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
            Este cadastro é pra gastos que não são produtos (salário, luz, honorários). Produtos são cadastrados em Módulo Contábil → Cadastro de produtos.
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

// Lista de itens de custo que NÃO são produto (categorias de despesa).
export function NonProductCostItems({
  items,
  centers,
  ledgerAccounts,
}: {
  items: CostItemWithLinks[];
  centers: { id: string; name: string }[];
  ledgerAccounts: LedgerAccount[];
}) {
  const centerOptions = centers.map((c) => ({ id: c.id, label: c.name }));
  const ledgerByCode = new Map(ledgerAccounts.map((a) => [a.code, a]));
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg">Despesas cadastradas</h3>
        <CostItemDialog centerOptions={centerOptions} ledgerAccounts={ledgerAccounts} />
      </div>
      <p className="text-xs text-muted-foreground">
        Categorias de gasto sem estoque (salário, luz, honorários, impostos…) — usadas em “Lançar Despesa”.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">
                  {item.name}
                  {!item.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.centers.length > 0 ? item.centers.map((c) => `${c.center_name} ${c.alloc_pct}%`).join(" · ") : "Sem centro vinculado"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conta contábil: {item.ledger_account_code ? (ledgerByCode.get(item.ledger_account_code)?.name ?? item.ledger_account_code) : "Padrão automático"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <CostItemDialog item={item} centerOptions={centerOptions} ledgerAccounts={ledgerAccounts} />
                <DeleteButton action={() => deleteCostItem(item.id)} />
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item cadastrado.</p>}
      </div>
    </section>
  );
}

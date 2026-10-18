"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createLedgerAccount, updateLedgerAccount } from "@/lib/actions/ledger";
import type { LedgerAccount, LedgerAccountGroup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

const GROUP_LABELS: Record<LedgerAccountGroup, string> = {
  ativo: "Ativo",
  passivo: "Passivo",
  receita: "Receita",
  custo: "Custo",
  despesa: "Despesa",
};
const GROUP_ORDER: LedgerAccountGroup[] = ["ativo", "passivo", "receita", "custo", "despesa"];

export function LedgerAccountsPanel({ accounts }: { accounts: LedgerAccount[] }) {
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <LedgerAccountDialog />
      </div>
      {GROUP_ORDER.map((group) => {
        const groupAccounts = accounts.filter((a) => a.account_group === group);
        if (groupAccounts.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <h3 className="font-heading text-lg">{GROUP_LABELS[group]}</h3>
            <div className="space-y-2">
              {groupAccounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                  <div>
                    <p className="font-medium text-sm">
                      {a.display_code && <span className="text-muted-foreground mr-1.5">{a.display_code}</span>}
                      {a.name}
                      {!a.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativa</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.requires_cost_center ? "Pede centro de custo em cada lançamento" : "Sem centro de custo"}
                    </p>
                  </div>
                  <LedgerAccountDialog account={a} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {accounts.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma conta cadastrada.</p>}
    </div>
  );
}

function LedgerAccountDialog({ account }: { account?: LedgerAccount }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!account;

  const [code, setCode] = useState(account?.code ?? "");
  const [displayCode, setDisplayCode] = useState(account?.display_code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [accountGroup, setAccountGroup] = useState<LedgerAccountGroup>(account?.account_group ?? "despesa");
  const [requiresCostCenter, setRequiresCostCenter] = useState(account?.requires_cost_center ?? true);
  const [active, setActive] = useState(account?.active ?? true);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome da conta.");
      return;
    }
    if (!isEdit && !code.trim()) {
      toast.error("Informe o código da conta.");
      return;
    }
    startTransition(async () => {
      const result = isEdit
        ? await updateLedgerAccount(account.id, name, active, requiresCostCenter, displayCode || null)
        : await createLedgerAccount(code, name, accountGroup, requiresCostCenter, displayCode || null);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Conta salva.");
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
              <Plus size={14} /> Nova conta
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta contábil"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Código (não muda depois de criado)</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex.: tarifas-cartao" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Código de exibição (opcional, ex.: 1.10)</Label>
            <Input value={displayCode} onChange={(e) => setDisplayCode(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <Select value={accountGroup} onValueChange={(v) => v && setAccountGroup(v as LedgerAccountGroup)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione">{(v: string) => GROUP_LABELS[v as LedgerAccountGroup]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GROUP_ORDER.map((g) => (
                    <SelectItem key={g} value={g}>
                      {GROUP_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={requiresCostCenter} onCheckedChange={(c) => setRequiresCostCenter(c === true)} />
            Pede centro de custo em cada lançamento
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Ativa
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

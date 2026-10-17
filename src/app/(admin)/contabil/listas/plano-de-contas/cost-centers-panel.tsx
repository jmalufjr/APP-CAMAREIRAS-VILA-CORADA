"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { createCostCenter, updateCostCenter, deleteCostCenter } from "@/lib/actions/cost-plan";
import type { CostCenter } from "@/lib/types";
import { DeleteButton } from "@/components/shared/delete-button";

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

export function CostCentersPanel({ centers }: { centers: CostCenter[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg">Centros de custo</h3>
        <CostCenterDialog />
      </div>
      <p className="text-xs text-muted-foreground">
        Dizem DE QUE PARTE da pousada é um gasto (Hospedagem, Café da manhã, Bar da piscina, Frigobar, Administração e áreas comuns). Os produtos e itens de custo se ligam a eles por percentual.
      </p>
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
  );
}

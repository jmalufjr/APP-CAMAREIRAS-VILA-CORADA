"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateExpenseSettings } from "@/lib/actions/expense-model";
import type { ExpenseSettings } from "@/lib/expense-model-types";

export function SettingsCard({ settings }: { settings: ExpenseSettings }) {
  const [threshold, setThreshold] = useState(String(settings.asset_threshold));
  const [life, setLife] = useState(String(settings.asset_min_life_months));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const r = await updateExpenseSettings(Number(threshold.replace(",", ".")), Number(life));
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Parâmetros salvos.");
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3 max-w-md">
      <h3 className="font-heading text-lg">Ativo permanente</h3>
      <p className="text-xs text-muted-foreground">
        Um item só é ativo permanente (e não despesa do mês) se o valor for igual ou maior que o limite <strong>e</strong> a vida útil for maior que o mínimo. Não há depreciação.
      </p>
      <div className="space-y-1.5">
        <Label>Valor mínimo do item (R$)</Label>
        <Input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Vida útil mínima (meses, deve ser maior que)</Label>
        <Input type="number" min={1} value={life} onChange={(e) => setLife(e.target.value)} />
      </div>
      <Button size="sm" onClick={save} disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar parâmetros"}
      </Button>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveChannelCommission, type CommissionRow } from "@/lib/actions/indicators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Comissão de cada canal de venda (%), informada pelo admin. Vale para todos os meses.
export function CommissionCard({ rows }: { rows: CommissionRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.channel, String(r.percent).replace(".", ",")]))
  );

  function save() {
    startTransition(async () => {
      let failed = false;
      for (const r of rows) {
        const next = Number((values[r.channel] ?? "0").replace(",", "."));
        if (next === r.percent) continue;
        const result = await saveChannelCommission(r.channel, next);
        if ("error" in result && result.error) {
          toast.error(`${r.label}: ${result.error}`);
          failed = true;
        }
      }
      if (!failed) toast.success("Comissões salvas.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Comissão por canal de venda</CardTitle>
        <p className="text-xs text-muted-foreground">
          A comissão de cada reserva vem da própria Stays (valor em R$ informado por Booking, Airbnb e Decolar). O percentual abaixo é
          usado <strong>só quando a Stays não informa o valor</strong> (hoje, a Expedia) e vale para todos os meses. ADR e RevPAR usam a
          receita antes das comissões; o NetRevPAR desconta as comissões.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {rows.map((r) => (
            <div key={r.channel} className="space-y-1">
              <label className="text-xs text-muted-foreground">{r.label}</label>
              <div className="flex items-center gap-1">
                <Input
                  inputMode="decimal"
                  value={values[r.channel] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [r.channel]: e.target.value }))}
                  aria-label={`Comissão ${r.label} (%)`}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" onClick={save} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar comissões"}
        </Button>
      </CardContent>
    </Card>
  );
}

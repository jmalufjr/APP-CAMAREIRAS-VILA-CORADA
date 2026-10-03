"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CountLineView } from "@/lib/actions/inventory-counts";
import { setCountLineValue, closeCountSession, updateItemQuebraMaximaAdmitida, updateItemIndiceRelativoMaximo } from "@/lib/actions/inventory-counts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { formatDateShortPt, dateKeyInBrazil } from "@/lib/date";

function formatPct(v: number | null): string {
  if (v === null) return "—";
  const rounded = Math.round(v * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function CountSessionPanel({ sessionId, lines }: { sessionId: string; lines: CountLineView[] }) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.id, l.counted_qty === null ? "" : String(l.counted_qty)]))
  );
  const [thresholds, setThresholds] = useState<Record<string, { quebraMaxima: number; indiceMaximo: number }>>(
    Object.fromEntries(lines.map((l) => [l.inventory_item_id, { quebraMaxima: l.quebra_maxima_admitida_pct, indiceMaximo: l.indice_relativo_maximo_pct }]))
  );
  const router = useRouter();

  function handleBlur(lineId: string) {
    const raw = values[lineId];
    if (raw === "") return;
    const qty = Number(raw);
    if (Number.isNaN(qty)) return;
    startTransition(async () => {
      const result = await setCountLineValue(lineId, qty);
      if (result?.error) toast.error(result.error);
    });
  }

  function handleQuebraMaximaChange(itemId: string, pct: number) {
    setThresholds((prev) => ({ ...prev, [itemId]: { ...prev[itemId], quebraMaxima: pct } }));
    startTransition(async () => {
      const result = await updateItemQuebraMaximaAdmitida(itemId, pct);
      if (result?.error) toast.error(result.error);
    });
  }

  function handleIndiceMaximoChange(itemId: string, pct: number) {
    setThresholds((prev) => ({ ...prev, [itemId]: { ...prev[itemId], indiceMaximo: pct } }));
    startTransition(async () => {
      const result = await updateItemIndiceRelativoMaximo(itemId, pct);
      if (result?.error) toast.error(result.error);
    });
  }

  const pendingCount = lines.filter((l) => {
    const raw = values[l.id];
    return raw === undefined || raw === "";
  }).length;

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <p className="text-sm text-muted-foreground">{pendingCount} item(ns) ainda sem contagem física informada.</p>
      )}

      <div className="space-y-2">
        {lines.map((line) => {
          const raw = values[line.id];
          const counted = raw === "" || raw === undefined ? null : Number(raw);
          const diff = counted === null ? null : counted - line.theoretical_qty;
          const quebraPct = diff === null || line.theoretical_qty === 0 ? null : (diff / line.theoretical_qty) * 100;
          const thresholdState = thresholds[line.inventory_item_id] ?? { quebraMaxima: line.quebra_maxima_admitida_pct, indiceMaximo: line.indice_relativo_maximo_pct };
          const indiceRelativo =
            quebraPct !== null && line.quebra_12m_pct !== null && line.quebra_12m_pct !== 0
              ? Math.abs((quebraPct / line.quebra_12m_pct) * 100)
              : null;
          const isAboveQuebraMaxima = quebraPct !== null && Math.abs(quebraPct) > thresholdState.quebraMaxima;
          const isOutlier = indiceRelativo !== null && indiceRelativo > thresholdState.indiceMaximo;

          return (
            <div key={line.id} className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{line.item_name}</p>
                <p className="text-xs text-muted-foreground">
                  Saldo no sistema: {line.theoretical_qty} {line.unit}
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Contagem física</p>
                  <Input
                    type="number"
                    className="w-28"
                    value={raw}
                    onChange={(e) => setValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                    onBlur={() => handleBlur(line.id)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Diferença</p>
                  <p className={diff !== null && diff !== 0 ? "text-destructive font-medium" : "text-sm"}>
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Quebra de estoque</p>
                  <p className={isAboveQuebraMaxima ? "text-destructive font-medium" : "text-sm"}>{formatPct(quebraPct)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Quebra 12 meses</p>
                  <p className="text-sm">{formatPct(line.quebra_12m_pct)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Data da contagem anterior</p>
                  <p className="text-sm">{line.previous_count_date ? formatDateShortPt(dateKeyInBrazil(line.previous_count_date)) : "—"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4 border-t border-border pt-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Quebra máxima admitida</p>
                  <div className="flex items-center gap-1">
                    <QuantityStepper
                      value={thresholdState.quebraMaxima}
                      onChange={(v) => handleQuebraMaximaChange(line.inventory_item_id, v)}
                      min={1}
                      disabled={isPending}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Índice de quebra relativo</p>
                  <p className={isOutlier ? "text-destructive font-medium" : "text-sm"}>{indiceRelativo === null ? "—" : `${Math.round(indiceRelativo)}%`}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Índice de quebra relativo máximo</p>
                  <div className="flex items-center gap-1">
                    <QuantityStepper
                      value={thresholdState.indiceMaximo}
                      onChange={(v) => handleIndiceMaximoChange(line.inventory_item_id, v)}
                      min={1}
                      disabled={isPending}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        disabled={isPending || pendingCount > 0}
        onClick={() => {
          if (!confirm("Fechar a contagem e ajustar o estoque conforme os valores informados?")) return;
          startTransition(async () => {
            const result = await closeCountSession(sessionId);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            if (result?.warning) toast.warning(result.warning);
            else toast.success("Contagem fechada e estoque ajustado.");
            router.push("/compras/contagem");
            router.refresh();
          });
        }}
      >
        Fechar contagem e ajustar estoque
      </Button>
    </div>
  );
}

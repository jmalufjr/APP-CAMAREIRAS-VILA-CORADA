"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CountLineView } from "@/lib/actions/inventory-counts";
import { setCountLineValue, closeCountSession } from "@/lib/actions/inventory-counts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export function CountSessionPanel({ sessionId, lines }: { sessionId: string; lines: CountLineView[] }) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.id, l.counted_qty === null ? "" : String(l.counted_qty)]))
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

  const pendingCount = lines.filter((l) => {
    const raw = values[l.id];
    return raw === undefined || raw === "";
  }).length;

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <p className="text-sm text-muted-foreground">{pendingCount} item(ns) ainda sem contagem física informada.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Saldo no sistema</TableHead>
              <TableHead>Contagem física</TableHead>
              <TableHead>Diferença</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const raw = values[line.id];
              const counted = raw === "" || raw === undefined ? null : Number(raw);
              const diff = counted === null ? null : counted - line.theoretical_qty;
              return (
                <TableRow key={line.id}>
                  <TableCell>{line.item_name}</TableCell>
                  <TableCell>
                    {line.theoretical_qty} {line.unit}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-28"
                      value={raw}
                      onChange={(e) => setValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                      onBlur={() => handleBlur(line.id)}
                    />
                  </TableCell>
                  <TableCell className={diff !== null && diff !== 0 ? "text-destructive font-medium" : ""}>
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
            toast.success("Contagem fechada e estoque ajustado.");
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

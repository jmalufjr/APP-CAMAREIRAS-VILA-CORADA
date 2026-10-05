"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PurchaseListRow } from "@/lib/actions/purchase-list";
import { cancelPurchaseRequestsForItem } from "@/lib/actions/purchase-requests";
import { dismissCalculatedSuggestion, reactivateCalculatedSuggestion } from "@/lib/actions/purchase-list";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { X, RotateCcw } from "lucide-react";

export function PurchaseListTable({ rows }: { rows: PurchaseListRow[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Saldo atual</TableHead>
            <TableHead>Giro (por semana)</TableHead>
            <TableHead>Sugestão do sistema</TableHead>
            <TableHead>Pedido da equipe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.inventory_item_id}>
              <TableCell>
                <p className="font-medium">{r.item_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.category_name}
                  {r.coverage_days !== null ? ` · ${r.coverage_days}d de folga` : ""}
                </p>
              </TableCell>
              <TableCell>
                {r.balance} {r.unit}
              </TableCell>
              <TableCell>
                {r.weekly_consumption.toFixed(2)} {r.unit}/semana
              </TableCell>
              <TableCell>
                {r.suggested_qty_calculated > 0 ? (
                  r.calculated_dismissed ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground italic">Dispensada pelo admin</p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        title="Reativar sugestão calculada"
                        onClick={() => {
                          startTransition(async () => {
                            const result = await reactivateCalculatedSuggestion(r.inventory_item_id);
                            if (result?.error) toast.error(result.error);
                            else router.refresh();
                          });
                        }}
                      >
                        <RotateCcw size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="destructive">
                        {r.suggested_qty_calculated.toFixed(2)} {r.unit}
                      </Badge>
                      {r.suggested_qty_calculated_purchase_unit !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ≈ {r.suggested_qty_calculated_purchase_unit.toFixed(2)} kg a comprar
                        </p>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        title="Dispensar sugestão calculada"
                        onClick={() => {
                          if (!confirm(`Dispensar a sugestão calculada de "${r.item_name}"?`)) return;
                          startTransition(async () => {
                            const result = await dismissCalculatedSuggestion(r.inventory_item_id);
                            if (result?.error) toast.error(result.error);
                            else router.refresh();
                          });
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  )
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                {r.requested_qty_team > 0 ? (
                  <div className="space-y-1">
                    <Badge variant="secondary">
                      {r.requested_qty_team} {r.unit}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{r.requester_names.join(", ")}</p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      title="Cancelar pedido da equipe"
                      onClick={() => {
                        if (!confirm(`Cancelar todo o pedido de "${r.item_name}" feito pela equipe?`)) return;
                        startTransition(async () => {
                          const result = await cancelPurchaseRequestsForItem(r.inventory_item_id);
                          if (result?.error) toast.error(result.error);
                          else router.refresh();
                        });
                      }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum item precisa de compra no momento.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

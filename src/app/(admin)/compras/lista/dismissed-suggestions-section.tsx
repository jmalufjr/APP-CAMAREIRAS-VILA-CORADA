"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DismissedSuggestionRow } from "@/lib/actions/purchase-list";
import { reactivateCalculatedSuggestion } from "@/lib/actions/purchase-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimePt } from "@/lib/date";
import { RotateCcw } from "lucide-react";

// Itens cuja sugestão calculada foi dispensada pelo admin e continua
// dispensada (saldo não mudou desde então) — não aparecem na tabela
// principal a menos que também tenham um pedido da equipe pendente, então
// ficam aqui, visíveis e reativáveis a qualquer momento.
export function DismissedSuggestionsSection({ rows }: { rows: DismissedSuggestionRow[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Sugestões calculadas dispensadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.inventory_item_id} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <span className="font-medium">{r.item_name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                dispensada em {formatDateTimePt(r.dismissed_at)}
                {r.dismissed_by_name ? ` por ${r.dismissed_by_name}` : ""}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await reactivateCalculatedSuggestion(r.inventory_item_id);
                  if (result?.error) toast.error(result.error);
                  else router.refresh();
                });
              }}
            >
              <RotateCcw size={14} /> Reativar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

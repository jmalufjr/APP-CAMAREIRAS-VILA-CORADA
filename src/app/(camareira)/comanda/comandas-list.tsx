"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { ComandaListItem } from "@/lib/actions/comandas";
import { Button } from "@/components/ui/button";
import { ComandaDetailDialog } from "@/components/shared/comanda-detail-dialog";

export function ComandasList({ comandas }: { comandas: ComandaListItem[] }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ComandaListItem | null>(null);

  if (comandas.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma comanda ativa no momento.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {comandas.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => setDetail(c)}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Comanda #{c.monthly_number ?? c.sequence_number} · Suíte {c.room_number}
              </p>
              <p className="text-xs text-muted-foreground truncate">Responsável: {c.created_by_name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium">R$ {c.total.toFixed(2)}</span>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/comanda/${c.id}/editar`);
                }}
              >
                <Pencil size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <ComandaDetailDialog comanda={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </>
  );
}

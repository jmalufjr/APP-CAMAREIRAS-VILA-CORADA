"use client";

import { useState } from "react";
import type { ComandaListItem } from "@/lib/actions/comandas";
import { Badge } from "@/components/ui/badge";
import { ComandaDetailDialog } from "@/components/shared/comanda-detail-dialog";
import { comandaDisplayStatus } from "@/lib/comanda-status";
import { formatDateTimePt } from "@/lib/date";

function ComandaRow({ comanda, onClick }: { comanda: ComandaListItem; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className="rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium flex flex-wrap items-center gap-2">
          Comanda #{comanda.sequence_number} · Suíte {comanda.room_number}
          <Badge variant={comanda.status === "cancelada" ? "secondary" : "outline"}>
            {comandaDisplayStatus(comanda)}
          </Badge>
        </p>
        <span className="text-sm font-medium">R$ {comanda.total.toFixed(2)}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Original: {comanda.created_by_name} em {formatDateTimePt(comanda.created_at)} · Última ação:{" "}
        {comanda.last_action_by_name} em {formatDateTimePt(comanda.last_action_at)}
        {comanda.bill_paid_at && <> · Paga em {formatDateTimePt(comanda.bill_paid_at)}</>}
      </p>
    </div>
  );
}

export function ComandasListPanel({
  activeComandas,
  inactiveComandas,
}: {
  activeComandas: ComandaListItem[];
  inactiveComandas: ComandaListItem[];
}) {
  const [detail, setDetail] = useState<ComandaListItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">Comandas ativas</p>
        {activeComandas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma comanda ativa no momento.</p>
        ) : (
          <div className="space-y-2">
            {activeComandas.map((c) => (
              <ComandaRow key={c.id} comanda={c} onClick={() => setDetail(c)} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Comandas inativas</p>
        <p className="text-xs text-muted-foreground">Canceladas ou de contas pagas, dos últimos 7 dias.</p>
        {inactiveComandas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma comanda inativa nos últimos 7 dias.</p>
        ) : (
          <div className="space-y-2">
            {inactiveComandas.map((c) => (
              <ComandaRow key={c.id} comanda={c} onClick={() => setDetail(c)} />
            ))}
          </div>
        )}
      </div>

      <ComandaDetailDialog comanda={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}

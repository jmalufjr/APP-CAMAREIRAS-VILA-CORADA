"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComandaListItem } from "@/lib/actions/comandas";
import { Badge } from "@/components/ui/badge";
import { ComandaDetailDialog } from "@/components/shared/comanda-detail-dialog";
import { comandaDisplayStatus } from "@/lib/comanda-status";
import { formatDateTimePt } from "@/lib/date";
import { roomSlotLabel } from "@/lib/room-bill-label";

function ComandaRow({ comanda, onClick, canEdit }: { comanda: ComandaListItem; onClick: () => void; canEdit?: boolean }) {
  const router = useRouter();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className="rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium flex flex-wrap items-center gap-2">
          Comanda #{comanda.monthly_number ?? comanda.sequence_number} ·{" "}
          {roomSlotLabel({
            room_number: comanda.room_number,
            guestNameHint: comanda.guestNameHint,
            isWalkin: comanda.isWalkin,
          })}
          <Badge variant={comanda.status === "cancelada" ? "secondary" : "outline"}>
            {comandaDisplayStatus(comanda)}
          </Badge>
        </p>
        <span className="flex items-center gap-2 text-sm font-medium">
          R$ {comanda.total.toFixed(2)}
          {canEdit && (
            <Button
              size="icon-sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/comanda/${comanda.id}/editar`);
              }}
            >
              <Pencil size={14} />
            </Button>
          )}
        </span>
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
              <ComandaRow key={c.id} comanda={c} onClick={() => setDetail(c)} canEdit />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Comandas inativas</p>
        <p className="text-xs text-muted-foreground">Canceladas ou de contas pagas, dos últimos 30 dias.</p>
        {inactiveComandas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma comanda inativa nos últimos 30 dias.</p>
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

// Lista de comandas inativas com o detalhe ao clicar — usada também no Histórico (por período).
export function InactiveComandasList({ comandas, emptyText }: { comandas: ComandaListItem[]; emptyText: string }) {
  const [detail, setDetail] = useState<ComandaListItem | null>(null);
  if (comandas.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>;
  return (
    <>
      <div className="space-y-2">
        {comandas.map((c) => (
          <ComandaRow key={c.id} comanda={c} onClick={() => setDetail(c)} />
        ))}
      </div>
      <ComandaDetailDialog comanda={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </>
  );
}

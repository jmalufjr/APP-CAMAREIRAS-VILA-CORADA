"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { submitComanda, editComanda, cancelComanda } from "@/lib/actions/comandas";
import type { RoomOption } from "@/lib/actions/comandas";
import type { PoolbarItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function QuantityStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <Minus size={14} />
      </Button>
      <span className="w-6 text-center text-sm tabular-nums">{value}</span>
      <Button type="button" variant="outline" size="icon-sm" disabled={disabled} onClick={() => onChange(value + 1)}>
        <Plus size={14} />
      </Button>
    </div>
  );
}

export function ComandaForm({
  mode,
  comandaId,
  poolbarItems,
  rooms,
  initialRoomId,
  initialQuantities,
  initialComandaStatus,
  initialBillStatus,
}: {
  mode: "create" | "edit";
  comandaId?: string;
  poolbarItems: PoolbarItem[];
  rooms: RoomOption[];
  initialRoomId?: string;
  initialQuantities?: Record<string, number>;
  initialComandaStatus?: "original" | "cancelada" | "editada";
  initialBillStatus?: "aberta" | "fechada" | "reaberta" | "paga";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // Sempre uma string (nunca undefined) para o Select ficar controlado
  // desde o primeiro render — alternar undefined/string faz o Base UI
  // acusar o componente de trocar de não controlado para controlado.
  const [roomId, setRoomId] = useState<string>(initialRoomId ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities ?? {});

  // Uma vez cancelada a própria comanda, ou fechada/paga a conta A QUE ELA
  // PERTENCE (não a conta corrente do quarto — uma comanda antiga pode
  // pertencer a uma conta já paga mesmo que o quarto já tenha, desde então,
  // uma conta nova em andamento), nem editar nem cancelar são permitidos —
  // mesma regra bloqueada pela função SQL, replicada aqui só para travar a
  // tela proativamente em vez de só reagir a um erro do servidor.
  const isLocked =
    mode === "edit" &&
    (initialComandaStatus === "cancelada" ||
      (initialBillStatus !== undefined && initialBillStatus !== "aberta" && initialBillStatus !== "reaberta"));

  const groups = new Map<string, PoolbarItem[]>();
  poolbarItems.forEach((item) => {
    const key = item.category ?? "Outros";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });

  const hasAnyQuantity = Object.values(quantities).some((q) => q > 0);

  function handleSubmit() {
    if (isLocked) return;
    if (!roomId) {
      toast.error("Selecione o quarto.");
      return;
    }
    if (!hasAnyQuantity) {
      toast.error("Selecione ao menos um item com quantidade.");
      return;
    }
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([item_id, quantity]) => ({ item_id, quantity }));

    startTransition(async () => {
      const result =
        mode === "create"
          ? await submitComanda(roomId, items)
          : await editComanda(comandaId!, roomId, items);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Pedido enviado." : "Comanda atualizada.");
      router.push("/comanda");
      router.refresh();
    });
  }

  function handleCancelComanda() {
    if (!comandaId || isLocked) return;
    startTransition(async () => {
      const result = await cancelComanda(comandaId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Comanda cancelada.");
      router.push("/comanda");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {isLocked && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {initialComandaStatus === "cancelada"
            ? "Esta comanda já está cancelada."
            : "A conta a que esta comanda pertence está fechada ou já foi paga."}{" "}
          Não é possível editar nem cancelar esta comanda.
        </p>
      )}
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{category}</p>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <QuantityStepper
                    value={quantities[item.id] ?? 0}
                    disabled={isPending || isLocked}
                    onChange={(v) => setQuantities((prev) => ({ ...prev, [item.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {poolbarItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">Nenhum item de bar cadastrado.</p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background px-4 py-3 space-y-3 sm:mx-0 sm:rounded-lg sm:border">
        <div className="max-w-xs space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Quarto</label>
          <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")} disabled={isPending || isLocked}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o quarto" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.room_id} value={room.room_id} disabled={room.billStatus === "fechada"}>
                  Quarto {room.room_number}
                  {room.billStatus === "fechada" ? " (conta fechada)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSubmit} disabled={isPending || isLocked}>
            {mode === "create" ? "Enviar pedido" : "Salvar e reenviar"}
          </Button>
          {mode === "edit" && (
            <Button variant="destructive" disabled={isPending || isLocked} onClick={handleCancelComanda}>
              Cancelar comanda
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

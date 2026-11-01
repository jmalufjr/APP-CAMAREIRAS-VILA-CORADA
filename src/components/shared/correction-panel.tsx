"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DailyRoomTask, DailyRoomTaskCheck, RoomBillGuestSlot } from "@/lib/types";
import { startCorrection, setCorrectionCheck, setCorrectionMinibarDone, finishCorrection } from "@/lib/actions/tasks";
import type { MinibarRoomConsumption } from "@/lib/actions/minibar";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type CheckRow = DailyRoomTaskCheck & { checklist_items: { label: string; description: string | null } };

// Serviço de correção (camareira EXECUTORA): só os itens que a revisora marcou como
// incompletos. Só abre depois de "Iniciar correção". O frigobar, se incompleto,
// reabre já com os valores registrados antes — só são gravados ao finalizar a correção
// (PRD_camareira_revisora.md seção 3.3).
export function CorrectionPanel({
  task,
  checks,
  minibar,
  minibarGuestSlot,
  reviewerName,
}: {
  task: DailyRoomTask;
  checks: CheckRow[];
  minibar?: MinibarRoomConsumption;
  minibarGuestSlot: RoomBillGuestSlot;
  reviewerName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const incompleteChecks = checks.filter((c) => c.review_result === "incompleto");
  const minibarIncomplete = task.review_minibar_result === "incompleto";
  const started = task.status === "em_correcao";

  const [corrected, setCorrected] = useState<Record<string, boolean>>(
    Object.fromEntries(incompleteChecks.map((c) => [c.id, c.corrected]))
  );
  const [minibarDone, setMinibarDone] = useState(task.correction_minibar_done);
  const items = minibar?.items ?? [];
  const initialQuantities = Object.fromEntries(items.map((i) => [i.id, i.quantity]));
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);
  const isMinibarClosed = minibar?.billStatus === "fechada";

  const allDone = incompleteChecks.every((c) => corrected[c.id]) && (!minibarIncomplete || minibarDone);

  function toggleCorrected(checkId: string, next: boolean) {
    setCorrected((prev) => ({ ...prev, [checkId]: next }));
    startTransition(async () => {
      const r = await setCorrectionCheck(checkId, next);
      if (r?.error) {
        toast.error(r.error);
        setCorrected((prev) => ({ ...prev, [checkId]: !next }));
      }
    });
  }

  function toggleMinibarDone(next: boolean) {
    setMinibarDone(next);
    startTransition(async () => {
      const r = await setCorrectionMinibarDone(task.id, next);
      if (r?.error) {
        toast.error(r.error);
        setMinibarDone(!next);
      }
    });
  }

  const reviewBox = (
    <div className="space-y-1 rounded-lg bg-accent text-accent-foreground px-4 py-3 text-sm">
      <p>
        <strong>Serviço de correção</strong> — a revisão{reviewerName ? ` de ${reviewerName}` : ""} marcou itens como incompletos.
      </p>
      {task.review_notes && <p className="whitespace-pre-wrap">Observação da revisão: {task.review_notes}</p>}
    </div>
  );

  if (!started) {
    return (
      <div className="space-y-6">
        {reviewBox}
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-heading text-lg">Itens a corrigir</h3>
            <ul className="list-disc pl-5 text-base space-y-1">
              {incompleteChecks.map((c) => (
                <li key={c.id}>{c.checklist_items.label}</li>
              ))}
              {minibarIncomplete && <li>Consumo de frigobar</li>}
            </ul>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const r = await startCorrection(task.id);
                  if (r?.error) toast.error(r.error);
                  else router.refresh();
                })
              }
            >
              Iniciar correção
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviewBox}

      <div className="space-y-2">
        {incompleteChecks.map((check) => (
          <label
            key={check.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer"
          >
            <Checkbox
              checked={!!corrected[check.id]}
              disabled={isPending}
              onCheckedChange={(v) => toggleCorrected(check.id, !!v)}
            />
            <span className="text-base font-medium">{check.checklist_items.label}</span>
          </label>
        ))}
      </div>

      {minibarIncomplete && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-lg">Consumo de frigobar</h3>
              {isMinibarClosed && <Badge variant="secondary">Conta fechada</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Os valores abaixo são os que já estavam registrados. Edite se precisar; o consumo só é atualizado quando você
              finalizar a correção.
              {isMinibarClosed && " A conta está fechada, então o consumo não poderá ser alterado — o administrador ajusta depois."}
            </p>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <QuantityStepper
                    value={quantities[item.id] ?? 0}
                    disabled={isMinibarClosed}
                    onChange={(v) => setQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, Math.floor(v) || 0) }))}
                  />
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item de frigobar cadastrado.</p>}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={minibarDone} disabled={isPending} onCheckedChange={(v) => toggleMinibarDone(!!v)} />
              <span className="text-base font-medium">Frigobar corrigido</span>
            </label>
          </CardContent>
        </Card>
      )}

      <Button
        className="w-full"
        disabled={!allDone || isPending}
        onClick={() =>
          startTransition(async () => {
            const changes = minibarIncomplete && !isMinibarClosed
              ? items.filter((i) => (quantities[i.id] ?? 0) !== (initialQuantities[i.id] ?? 0)).map((i) => ({ itemId: i.id, quantity: quantities[i.id] ?? 0 }))
              : [];
            const r = await finishCorrection(task.id, task.room_id, minibarGuestSlot, changes);
            if (r?.error) {
              toast.error(r.error);
              return;
            }
            if (r.warning) toast.warning(r.warning);
            toast.success("Correção finalizada — serviço concluído.");
            router.push("/tarefas");
            router.refresh();
          })
        }
      >
        {allDone ? "Finalizar correção" : "Marque todos os itens corrigidos para finalizar"}
      </Button>
    </div>
  );
}

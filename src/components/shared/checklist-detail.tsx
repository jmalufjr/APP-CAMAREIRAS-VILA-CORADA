"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DailyRoomTask, DailyRoomTaskCheck, OccurrenceCategory } from "@/lib/types";
import { TASK_STATUS_LABELS, isTaskInExecution } from "@/lib/types";
import { finalizeService } from "@/lib/actions/tasks";
import { OccurrencesCard, type OccurrenceRow } from "@/components/shared/occurrences-card";
import { DraftOccurrencesCard, type DraftOccurrence } from "@/components/shared/draft-occurrences-card";
import { uploadOccurrencePhotos } from "@/lib/actions/occurrence-photos";
import { compressImageForUpload } from "@/lib/image-compression";
import type { MinibarTaskContext } from "@/lib/actions/minibar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Info } from "lucide-react";

type CheckRow = DailyRoomTaskCheck & { checklist_items: { label: string; description: string | null } };

// Consumo de frigobar DO DIA registrado neste serviço (só leitura).
export type TaskMinibarRow = { id: string; itemId: string; name: string; quantity: number };

export function ChecklistDetail({
  task,
  checks,
  occurrences,
  categories,
  minibar,
  taskMinibar,
  readOnly = false,
}: {
  task: DailyRoomTask;
  checks: CheckRow[];
  occurrences: OccurrenceRow[];
  categories: OccurrenceCategory[];
  // Só passado pela execução da camareira (serviço ainda aberto): itens de frigobar e a conta de quem
  // dormiu na suíte na noite anterior. Nunca mostra o consumo acumulado da conta.
  minibar?: MinibarTaskContext;
  // Serviço já finalizado (camareira ou admin, só leitura): o consumo de frigobar que foi lançado NESTE
  // serviço. Bar da piscina não tem relação com o serviço e nunca aparece aqui.
  taskMinibar?: TaskMinibarRow[];
  // Visão do admin: nunca permite finalizar nem editar nada.
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [bedlinenChanged, setBedlinenChanged] = useState(task.bedlinen_changed);
  // Tudo o que a camareira preenche fica só na tela: nada é gravado (itens, frigobar, ocorrências,
  // observações) até ela tocar em "Serviço na suíte finalizado". Voltar de tela não grava nada.
  const [localChecks, setLocalChecks] = useState(checks);
  const [drafts, setDrafts] = useState<DraftOccurrence[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [syncedChecks, setSyncedChecks] = useState(checks);
  if (checks !== syncedChecks) {
    setSyncedChecks(checks);
    setLocalChecks(checks);
  }

  // Depois de finalizada pela executora (revisão, correção ou concluído), o checklist dela é só leitura.
  const isReleased = readOnly || !isTaskInExecution(task.status);

  // Consumo DIFERENCIAL do dia: começa sempre em zero (a camareira não vê o acumulado da conta).
  // Somente Chegada não tem frigobar: a suíte estava vazia na noite anterior.
  const showMinibarEntry = !!minibar && !isReleased && task.task_type !== "somente_chegada";
  const minibarItems = minibar?.items ?? [];
  const isMinibarClosed = minibar?.billStatus === "fechada";
  const [dayQuantities, setDayQuantities] = useState<Record<string, number>>({});
  const [hasMinibarConsumption, setHasMinibarConsumption] = useState(false);

  function handleToggle(checkId: string, next: boolean) {
    setLocalChecks((prev) => prev.map((c) => (c.id === checkId ? { ...c, checked: next } : c)));
  }

  async function handleFinalize() {
    if (!localChecks.every((c) => c.checked)) {
      toast.error("Marque todos os itens do checklist antes de finalizar o serviço.");
      return;
    }
    setFinalizing(true);
    try {
      const minibarToSend = hasMinibarConsumption && !isMinibarClosed
        ? Object.entries(dayQuantities)
            .filter(([, q]) => q > 0)
            .map(([itemId, quantity]) => ({ itemId, quantity }))
        : [];
      const result = await finalizeService({
        taskId: task.id,
        checkedIds: localChecks.filter((c) => c.checked).map((c) => c.id),
        notes,
        bedlinenChanged,
        occurrences: drafts.map((d) => ({ categoryId: d.categoryId, description: d.description })),
        minibar: minibarToSend,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      // Fotos das ocorrências: só agora que as ocorrências existem.
      const ids = result.occurrenceIds ?? [];
      for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i];
        if (draft.photos.length === 0 || !ids[i]) continue;
        const compressed = await Promise.all(draft.photos.map((p) => compressImageForUpload(p.file)));
        const formData = new FormData();
        compressed.forEach((blob, n) => formData.append("files", blob, `foto-${n + 1}.jpg`));
        const upload = await uploadOccurrencePhotos(ids[i], formData);
        if (upload?.error) toast.error(`Serviço finalizado, mas houve erro ao enviar fotos de uma ocorrência: ${upload.error}`);
      }
      toast.success("Serviço na suíte finalizado.");
      router.refresh();
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="space-y-6">
      {isReleased && (
        <div className="flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-4 py-3 text-sm">
          <CheckCircle2 size={18} />{" "}
          {task.status === "concluido" ? "Serviço concluído." : `Suíte liberada — ${TASK_STATUS_LABELS[task.status].toLowerCase()}.`}
        </div>
      )}

      <div className="space-y-2">
        {localChecks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <label className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer">
              <Checkbox
                checked={check.checked}
                disabled={isReleased || finalizing}
                onCheckedChange={(v) => handleToggle(check.id, !!v)}
              />
              <span className="text-base font-medium">{check.checklist_items.label}</span>
            </label>
            {check.checklist_items.description && (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                      <Info size={18} />
                    </Button>
                  }
                />
                <PopoverContent className="w-[min(20rem,85vw)] text-base" align="end">
                  {check.checklist_items.description}
                </PopoverContent>
              </Popover>
            )}
          </div>
        ))}
      </div>

      {showMinibarEntry && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-lg">Consumo de frigobar</h3>
              <div className="flex items-center gap-2">
                {isMinibarClosed && <Badge variant="secondary">Conta fechada</Badge>}
                <Label htmlFor="minibar-consumption" className="text-sm font-normal">
                  Houve consumo de frigobar?
                </Label>
                <Switch
                  id="minibar-consumption"
                  checked={hasMinibarConsumption}
                  disabled={isMinibarClosed || finalizing}
                  onCheckedChange={(checked) => {
                    setHasMinibarConsumption(!!checked);
                    // Desligar descarta só o que foi marcado nesta tela; nada que já esteja na conta é tocado.
                    if (!checked) setDayQuantities({});
                  }}
                />
              </div>
            </div>
            {isMinibarClosed ? (
              <p className="text-xs text-muted-foreground">
                A conta do hóspede está fechada: lance esse consumo em Consumo por suítes &gt; Lançar consumo adicional.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Marque só o que foi consumido desde o último serviço{minibar?.guestName ? ` (conta de ${minibar.guestName})` : ""}.
                O consumo é gravado quando você finalizar o serviço.
                {!minibar?.resolved && " Não foi possível identificar o hóspede agora; o sistema tentará de novo ao finalizar."}
              </p>
            )}
            {hasMinibarConsumption && !isMinibarClosed && (
              <div className="space-y-2">
                {minibarItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <QuantityStepper
                      value={dayQuantities[item.id] ?? 0}
                      disabled={finalizing}
                      onChange={(v) =>
                        setDayQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, Math.floor(v) || 0) }))
                      }
                    />
                  </div>
                ))}
                {minibarItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum item de frigobar cadastrado.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isReleased && taskMinibar && task.task_type !== "somente_chegada" && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-heading text-lg">Consumo de frigobar do dia</h3>
            {taskMinibar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum consumo de frigobar registrado neste serviço.</p>
            ) : (
              <div className="space-y-1.5 max-w-md">
                {taskMinibar.map((row) => (
                  <div key={row.id} className="flex items-center justify-between text-sm">
                    <span>{row.name}</span>
                    <span className="text-muted-foreground">× {row.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {task.task_type === "arrumacao" && (!isReleased || task.bedlinen_changed) && (
        <Card>
          <CardContent>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0"
                checked={bedlinenChanged}
                disabled={isReleased || finalizing}
                onChange={(e) => setBedlinenChanged(e.target.checked)}
              />
              <span>
                <span className="font-medium">Houve troca de roupa de cama e banho a pedido do hóspede</span>
                <span className="block text-xs text-muted-foreground">
                  Marque quando o hóspede pedir a troca nesta arrumação: o calendário de trocas da estadia é atualizado.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      {isReleased ? (
        <OccurrencesCard taskId={task.id} occurrences={occurrences} categories={categories} canEdit={false} />
      ) : (
        <DraftOccurrencesCard drafts={drafts} onChange={setDrafts} categories={categories} saved={occurrences} />
      )}

      {!isReleased && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-heading text-lg">Observações finais</h3>
            <Textarea
              placeholder="Alguma observação sobre o trabalho realizado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button className="w-full" disabled={finalizing} onClick={handleFinalize}>
              {finalizing ? "Finalizando..." : "Serviço na suíte finalizado"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isReleased && (
        <Card>
          <CardContent>
            <h3 className="font-heading text-lg mb-2">Observações</h3>
            <p className="text-sm text-muted-foreground">{task.notes || "Nenhuma observação registrada."}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

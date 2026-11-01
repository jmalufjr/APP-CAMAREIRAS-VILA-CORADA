"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DailyRoomTask, DailyRoomTaskCheck, OccurrenceCategory, ReviewResult } from "@/lib/types";
import {
  releaseReview,
  setReviewCheckResult,
  setReviewMinibarResult,
  finishReview,
} from "@/lib/actions/tasks";
import { OccurrencesCard, type OccurrenceRow } from "@/components/shared/occurrences-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";

type CheckRow = DailyRoomTaskCheck & { checklist_items: { label: string; description: string | null } };

const RESULT_LABELS: Record<ReviewResult, string> = { completo: "Completo", incompleto: "Incompleto" };

function ResultSelect({ value, onChange }: { value: ReviewResult | null; onChange: (v: ReviewResult) => void }) {
  return (
    <Select value={value ?? ""} onValueChange={(v) => v && onChange(v as ReviewResult)}>
      <SelectTrigger className="w-40 shrink-0">
        <SelectValue placeholder="Selecione">{(v: string) => RESULT_LABELS[v as ReviewResult] ?? ""}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="completo">Completo</SelectItem>
        <SelectItem value="incompleto">Incompleto</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Tela da camareira REVISORA: o mesmo checklist da execução, mas cada item recebe
// "completo" ou "incompleto" (caixa de seleção que começa em branco). O consumo de
// frigobar é o último item. Só encerra quando tudo estiver marcado
// (PRD_camareira_revisora.md seção 3.2).
export function ReviewPanel({
  task,
  checks,
  occurrences,
  categories,
  executorName,
}: {
  task: DailyRoomTask;
  checks: CheckRow[];
  occurrences: OccurrenceRow[];
  categories: OccurrenceCategory[];
  executorName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [results, setResults] = useState<Record<string, ReviewResult | null>>(
    Object.fromEntries(checks.map((c) => [c.id, c.review_result]))
  );
  const [minibarResult, setMinibarResult] = useState<ReviewResult | null>(task.review_minibar_result);
  const [notes, setNotes] = useState(task.review_notes ?? "");

  const allSelected = checks.every((c) => results[c.id]) && !!minibarResult;
  const missing = checks.filter((c) => !results[c.id]).length + (minibarResult ? 0 : 1);

  function handleCheck(checkId: string, value: ReviewResult) {
    const previous = results[checkId] ?? null;
    setResults((prev) => ({ ...prev, [checkId]: value }));
    startTransition(async () => {
      const r = await setReviewCheckResult(checkId, value);
      if (r?.error) {
        toast.error(r.error);
        setResults((prev) => ({ ...prev, [checkId]: previous }));
      }
    });
  }

  function handleMinibar(value: ReviewResult) {
    const previous = minibarResult;
    setMinibarResult(value);
    startTransition(async () => {
      const r = await setReviewMinibarResult(task.id, value);
      if (r?.error) {
        toast.error(r.error);
        setMinibarResult(previous);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-accent text-accent-foreground px-4 py-3 text-sm">
        Revisão do serviço executado por <strong>{executorName ?? "—"}</strong>. Para cada item, escolha{" "}
        <strong>Completo</strong> ou <strong>Incompleto</strong>.
      </div>

      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
            <span className="min-w-0 flex-1 text-base font-medium">{check.checklist_items.label}</span>
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
            <ResultSelect value={results[check.id] ?? null} onChange={(v) => handleCheck(check.id, v)} />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="min-w-0 flex-1 text-base font-medium">Consumo de frigobar</span>
          <ResultSelect value={minibarResult} onChange={handleMinibar} />
        </div>
      </div>

      {task.notes && (
        <Card>
          <CardContent className="space-y-1">
            <h3 className="font-heading text-lg">Observações da executora</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
          </CardContent>
        </Card>
      )}

      <OccurrencesCard taskId={task.id} occurrences={occurrences} categories={categories} canEdit />

      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-heading text-lg">Observações da revisão</h3>
          <Textarea
            placeholder="Alguma observação sobre o serviço revisado..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={!allSelected || isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await finishReview(task.id, notes);
                if (r?.error) {
                  toast.error(r.error);
                  return;
                }
                toast.success(
                  r.outcome === "concluido"
                    ? "Revisão encerrada — serviço concluído."
                    : "Revisão encerrada — o serviço voltou para a executora corrigir."
                );
                router.push("/tarefas");
                router.refresh();
              })
            }
          >
            {allSelected ? "Encerrar revisão" : `Faltam ${missing} item(ns) para marcar completo/incompleto`}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Desistir desta revisão? O serviço volta a ficar pendente de revisão e o que você marcou é apagado.")) return;
              startTransition(async () => {
                const r = await releaseReview(task.id);
                if (r?.error) toast.error(r.error);
                else {
                  toast.success("Revisão cancelada.");
                  router.push("/tarefas");
                  router.refresh();
                }
              });
            }}
          >
            Desistir da revisão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

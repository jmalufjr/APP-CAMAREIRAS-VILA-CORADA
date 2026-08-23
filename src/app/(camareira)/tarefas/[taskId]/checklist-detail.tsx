"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DailyRoomTask, DailyRoomTaskCheck, DailyRoomTaskOccurrence, OccurrenceCategory } from "@/lib/types";
import { toggleCheck, addOccurrence, removeOccurrence, releaseTask } from "@/lib/actions/tasks";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, CheckCircle2 } from "lucide-react";

type CheckRow = DailyRoomTaskCheck & { checklist_items: { label: string; description: string | null } };
type OccurrenceRow = DailyRoomTaskOccurrence & { occurrence_categories: { name: string } };

export function ChecklistDetail({
  task,
  checks,
  occurrences,
  categories,
}: {
  task: DailyRoomTask;
  checks: CheckRow[];
  occurrences: OccurrenceRow[];
  categories: OccurrenceCategory[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [occDescription, setOccDescription] = useState("");

  const allChecked = checks.length > 0 && checks.every((c) => c.checked);
  const isReleased = task.status === "concluido";

  return (
    <div className="space-y-6">
      {isReleased && (
        <div className="flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-4 py-3 text-sm">
          <CheckCircle2 size={18} /> Quarto liberado.
        </div>
      )}

      <div className="space-y-2">
        {checks.map((check) => (
          <label
            key={check.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer"
          >
            <Checkbox
              checked={check.checked}
              disabled={isPending || isReleased}
              onCheckedChange={(v) =>
                startTransition(async () => {
                  const result = await toggleCheck(check.id, !!v);
                  if (result?.error) toast.error(result.error);
                  else router.refresh();
                })
              }
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">{check.checklist_items.label}</p>
              {check.checklist_items.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {check.checklist_items.description}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-heading text-lg">Ocorrências Manutenção</h3>
          <div className="space-y-2">
            {occurrences.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <div>
                  <Badge variant="secondary">{o.occurrence_categories.name}</Badge>
                  {o.description && <p className="text-sm mt-1">{o.description}</p>}
                </div>
                {!isReleased && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      startTransition(async () => {
                        await removeOccurrence(o.id);
                        router.refresh();
                      })
                    }
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!isReleased && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Categoria da ocorrência" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Descreva a ocorrência (opcional)"
                value={occDescription}
                onChange={(e) => setOccDescription(e.target.value)}
                className="flex-1 min-h-10"
              />
              <Button
                disabled={!categoryId || isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await addOccurrence(task.id, categoryId, occDescription);
                    if (result?.error) toast.error(result.error);
                    else {
                      setCategoryId("");
                      setOccDescription("");
                      router.refresh();
                    }
                  })
                }
              >
                Registrar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!isReleased && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-heading text-lg">Observações finais</h3>
            <Textarea
              placeholder="Alguma observação sobre o trabalho realizado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!allChecked || isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await releaseTask(task.id, notes);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Quarto liberado.");
                    router.refresh();
                  }
                })
              }
            >
              {allChecked ? "Liberar quarto" : "Marque todos os itens para liberar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isReleased && task.notes && (
        <Card>
          <CardContent>
            <h3 className="font-heading text-lg mb-2">Observações</h3>
            <p className="text-sm text-muted-foreground">{task.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

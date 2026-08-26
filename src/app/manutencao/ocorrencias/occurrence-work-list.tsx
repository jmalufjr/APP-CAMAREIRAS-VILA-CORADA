"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { selectOccurrence, resolveOccurrence, type ManutencaoOccurrenceRow } from "@/lib/actions/occurrences";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABELS = {
  pendente: "Pendente",
  selecionada: "Selecionada",
  resolvida: "Resolvida",
} as const;

function formatDateTimePt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OccurrenceWorkList({
  occurrences,
  currentUserId,
}: {
  occurrences: ManutencaoOccurrenceRow[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (occurrences.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma ocorrência pendente no momento.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {occurrences.map((o) => {
        const selectedByMe = o.selected_by === currentUserId;
        return (
          <Card key={o.id}>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">
                  Quarto {o.room_number} · {TASK_TYPE_LABELS[o.task_type]}
                </p>
                <Badge variant={o.status === "pendente" ? "secondary" : "default"}>
                  {STATUS_LABELS[o.status]}
                </Badge>
              </div>
              <Badge variant="secondary">{o.occurrence_categories?.name ?? "—"}</Badge>
              {o.description && <p className="text-sm">{o.description}</p>}
              <p className="text-xs text-muted-foreground">Camareira: {o.camareira_name}</p>
              <p className="text-xs text-muted-foreground">Registrado em: {formatDateTimePt(o.created_at)}</p>

              {o.status === "pendente" && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await selectOccurrence(o.id);
                      if (result?.error) toast.error(result.error);
                      else {
                        toast.success("Ocorrência selecionada.");
                        router.refresh();
                      }
                    });
                  }}
                >
                  Selecionar
                </Button>
              )}

              {o.status === "selecionada" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Selecionada por: {o.selected_by_profile?.name ?? "—"}
                    {o.selected_at && ` em ${formatDateTimePt(o.selected_at)}`}
                  </p>
                  {selectedByMe && (
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await resolveOccurrence(o.id);
                          if (result?.error) toast.error(result.error);
                          else {
                            toast.success("Ocorrência marcada como resolvida.");
                            router.refresh();
                          }
                        });
                      }}
                    >
                      Ocorrência resolvida
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

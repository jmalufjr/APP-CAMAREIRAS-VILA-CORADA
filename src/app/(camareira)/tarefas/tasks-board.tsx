"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import type { DailyRoomTask, Profile } from "@/lib/types";
import { claimTask, cancelTask } from "@/lib/actions/tasks";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatDateShortPt } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BedDouble, ChevronRight, Hand } from "lucide-react";

export type TaskWithRoom = DailyRoomTask & { rooms: { number: string; name: string | null } };

export function TasksBoard({
  profile,
  today,
  todayTasks,
  pastAvailableTasks,
  pastMineTasks,
}: {
  profile: Profile;
  today: string;
  todayTasks: TaskWithRoom[];
  pastAvailableTasks: TaskWithRoom[];
  pastMineTasks: TaskWithRoom[];
}) {
  if (profile.role !== "camareira") {
    // Visão simples para o admin (referência), sem ações de escolha.
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {todayTasks.map((task) => (
          <TaskCard key={task.id} task={task} today={today} />
        ))}
        {todayTasks.length === 0 && (
          <p className="text-muted-foreground text-sm py-8 col-span-2 text-center">
            Nenhum quarto planejado para hoje.
          </p>
        )}
      </div>
    );
  }

  const availableToday = todayTasks.filter((t) => !t.assigned_to && t.status !== "concluido");
  const mine = [...todayTasks.filter((t) => t.assigned_to === profile.id), ...pastMineTasks];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Disponíveis para escolher</h2>
        {availableToday.length === 0 && pastAvailableTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum quarto disponível no momento — todos já foram escolhidos.
          </p>
        ) : (
          <div className="space-y-6">
            {availableToday.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-heading text-base text-muted-foreground">Serviços de hoje</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {availableToday.map((task) => (
                    <AvailableTaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}
            {pastAvailableTasks.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-heading text-base text-muted-foreground">Serviços anteriores</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {pastAvailableTasks.map((task) => (
                    <AvailableTaskCard key={task.id} task={task} isPast />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Meus quartos</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não escolheu nenhum quarto hoje.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {mine.map((task) => (
              <TaskCard key={task.id} task={task} today={today} href={`/tarefas/${task.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AvailableTaskCard({ task, isPast }: { task: TaskWithRoom; isPast?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="size-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
            <BedDouble size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-medium">Quarto {task.rooms.number}</p>
            <p className="text-xs text-muted-foreground">
              {TASK_TYPE_LABELS[task.task_type]}
              {isPast && ` · ${formatDateShortPt(task.date)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPast && (
            <Button
              variant="outline"
              size="sm"
              className="h-5 gap-1 rounded-4xl px-2 py-0.5 text-xs"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelTask(task.id);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Serviço cancelado.");
                    router.refresh();
                  }
                })
              }
            >
              Cancelar
            </Button>
          )}
          <Button
            size="sm"
            className="h-5 gap-1 rounded-4xl px-2 py-0.5 text-xs [&_svg:not([class*='size-'])]:size-3"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await claimTask(task.id);
                if (result?.error) toast.error(result.error);
                else {
                  toast.success("Quarto escolhido!");
                  router.push(`/tarefas/${task.id}`);
                }
              })
            }
          >
            <Hand size={12} /> Escolher
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task, today, href }: { task: TaskWithRoom; today: string; href?: string }) {
  const isPast = task.date !== today;
  const content = (
    <Card className={href ? "hover:border-primary transition-colors" : undefined}>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="size-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
            <BedDouble size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-medium">Quarto {task.rooms.number}</p>
            <p className="text-xs text-muted-foreground">
              {TASK_TYPE_LABELS[task.task_type]}
              {isPast && ` · ${formatDateShortPt(task.date)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={task.status === "concluido" ? "default" : "secondary"}>
            {task.status === "concluido"
              ? "Concluído"
              : task.status === "em_andamento"
              ? "Em andamento"
              : "Pendente"}
          </Badge>
          {href && <ChevronRight size={16} className="text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import type { DailyRoomTask, Profile } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";
import { claimTask, cancelTask, unclaimTask, claimReview, claimExtraCleaningSecond } from "@/lib/actions/tasks";
import { taskTypeLabel } from "@/lib/task-type";
import { formatDateShortPt } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BedDouble, ChevronRight, ClipboardCheck, Hand, Undo2, X } from "lucide-react";

export type TaskWithRoom = DailyRoomTask & {
  rooms: { number: string; name: string | null };
  first?: { name: string } | null;
};

export function TasksBoard({
  profile,
  today,
  todayTasks,
  pastAvailableTasks,
  pastMineTasks,
  reviewTasks,
  waitingSecondTasks,
}: {
  profile: Profile;
  today: string;
  todayTasks: TaskWithRoom[];
  pastAvailableTasks: TaskWithRoom[];
  pastMineTasks: TaskWithRoom[];
  reviewTasks: TaskWithRoom[];
  waitingSecondTasks: TaskWithRoom[];
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
            Nenhuma suíte planejada para hoje.
          </p>
        )}
      </div>
    );
  }

  const availableToday = todayTasks.filter((t) => !t.assigned_to && t.status !== "concluido");
  const mine = [
    ...todayTasks.filter((t) => t.assigned_to === profile.id || t.second_assigned_to === profile.id),
    ...pastMineTasks,
  ];
  // Limpeza adicional que outra camareira já escolheu e espera a segunda (eu).
  const waitingForSecond = waitingSecondTasks.filter((t) => t.assigned_to !== profile.id);
  // Revisão: serviços de OUTRAS camareiras aguardando revisão, e os que eu já estou revisando.
  const reviewPool = reviewTasks.filter((t) => t.status === "aguardando_revisao" && t.assigned_to !== profile.id);
  const myReviews = reviewTasks.filter((t) => t.status === "em_revisao" && t.reviewed_by === profile.id);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Disponíveis para escolher</h2>
        {availableToday.length === 0 && pastAvailableTasks.length === 0 && waitingForSecond.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma suíte disponível no momento — todas já foram escolhidas.
          </p>
        ) : (
          <div className="space-y-6">
            {waitingForSecond.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-heading text-base text-muted-foreground">Limpeza adicional — falta a 2ª camareira</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {waitingForSecond.map((task) => (
                    <SecondClaimCard key={task.id} task={task} today={today} />
                  ))}
                </div>
              </div>
            )}
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

      {(reviewPool.length > 0 || myReviews.length > 0) && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg text-primary">Aguardando revisão</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {myReviews.map((task) => (
              <MyTaskCard key={task.id} task={task} today={today} meId={profile.id} />
            ))}
            {reviewPool.map((task) => (
              <ReviewTaskCard key={task.id} task={task} today={today} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Minhas suítes</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não escolheu nenhuma suíte hoje.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {mine.map((task) => (
              <MyTaskCard key={task.id} task={task} today={today} meId={profile.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Serviço liberado por outra camareira, aguardando alguém revisar.
function ReviewTaskCard({ task, today }: { task: TaskWithRoom; today: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isPast = task.date !== today;

  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="font-medium flex-1 min-w-0 truncate">Suíte {task.rooms.number}</p>
          <Button
            size="sm"
            className="h-auto flex-col gap-0.5 rounded-xl px-2 py-1 text-[10px] leading-tight [&_svg:not([class*='size-'])]:size-3.5"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await claimReview(task.id);
                if (result?.error) toast.error(result.error);
                else {
                  toast.success("Revisão iniciada!");
                  router.push(`/tarefas/${task.id}`);
                }
              })
            }
          >
            <ClipboardCheck size={14} />
            <span>Revisar</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {taskTypeLabel(task.task_type, task.extra_cleaning)} · {TASK_STATUS_LABELS[task.status]}
          {isPast && ` ${formatDateShortPt(task.date)}`}
        </p>
      </CardContent>
    </Card>
  );
}

// Limpeza adicional que a 1ª camareira já escolheu: a 2ª escolhe aqui e o serviço pode começar.
function SecondClaimCard({ task, today }: { task: TaskWithRoom; today: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isPast = task.date !== today;

  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="font-medium flex-1 min-w-0 truncate">Suíte {task.rooms.number}</p>
          <Button
            size="sm"
            className="h-auto flex-col gap-0.5 rounded-xl px-2 py-1 text-[10px] leading-tight [&_svg:not([class*='size-'])]:size-3.5"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await claimExtraCleaningSecond(task.id);
                if (result?.error) toast.error(result.error);
                else {
                  toast.success("Você é a 2ª camareira desta limpeza adicional. O checklist é da 1ª camareira.");
                  router.refresh();
                }
              })
            }
          >
            <Hand size={14} />
            <span>Escolher</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {taskTypeLabel(task.task_type, task.extra_cleaning)}
          {isPast && ` ${formatDateShortPt(task.date)}`}
          {task.first?.name ? ` · com ${task.first.name}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function AvailableTaskCard({ task, isPast }: { task: TaskWithRoom; isPast?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="font-medium flex-1 min-w-0 truncate">Suíte {task.rooms.number}</p>
          <div className="flex items-center gap-1 shrink-0">
            {isPast && (
              <Button
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-0.5 rounded-xl px-2 py-1 text-[10px] leading-tight [&_svg:not([class*='size-'])]:size-3.5"
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
                <X size={14} />
                <span>Cancelar</span>
              </Button>
            )}
            <Button
              size="sm"
              className="h-auto flex-col gap-0.5 rounded-xl px-2 py-1 text-[10px] leading-tight [&_svg:not([class*='size-'])]:size-3.5"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await claimTask(task.id);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Suíte escolhida!");
                    router.push(`/tarefas/${task.id}`);
                  }
                })
              }
            >
              <Hand size={14} />
              <span>Escolher</span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {taskTypeLabel(task.task_type, task.extra_cleaning)}
          {isPast && ` ${formatDateShortPt(task.date)}`}
        </p>
      </CardContent>
    </Card>
  );
}

// Card de "Minhas suítes" com o botão "Cancelar escolha" — só a parte de
// ícone+texto é um Link (não o card inteiro), pra o botão poder ficar fora
// dele sem aninhar um <button> dentro de um <a> (inválido em HTML e causa
// conflito de clique).
function MyTaskCard({ task, today, meId }: { task: TaskWithRoom; today: string; meId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isPast = task.date !== today;
  const canCancel = task.status === "pendente" || task.status === "em_andamento";
  // Sou a 2ª camareira da limpeza adicional: não tenho o checklist, só acompanho.
  const isSecond = task.second_assigned_to === meId && task.assigned_to !== meId;
  const waitingSecond = task.extra_cleaning && !task.second_assigned_to && canCancel;

  return (
    <Card className={isSecond ? undefined : "hover:border-primary transition-colors"}>
      <CardContent className="flex items-center justify-between gap-3">
        <Link
          href={`/tarefas/${task.id}`}
          className={`flex min-w-0 flex-1 items-center gap-3 ${isSecond ? "pointer-events-none" : ""}`}
          aria-disabled={isSecond}
          tabIndex={isSecond ? -1 : undefined}
        >
          <div className="size-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
            <BedDouble size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-medium">Suíte {task.rooms.number}</p>
            <p className="text-xs text-muted-foreground">
              {taskTypeLabel(task.task_type, task.extra_cleaning)}
              {isPast && ` · ${formatDateShortPt(task.date)}`}
              {isSecond && ` · você é a 2ª camareira (checklist com ${task.first?.name ?? "a 1ª"})`}
              {waitingSecond && " · aguardando a 2ª camareira"}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={task.status === "concluido" ? "default" : "secondary"}>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto flex-col gap-0.5 rounded-xl px-2 py-1 text-[10px] leading-tight [&_svg:not([class*='size-'])]:size-3.5"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await unclaimTask(task.id);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Escolha cancelada.");
                    router.refresh();
                  }
                })
              }
            >
              <Undo2 size={14} />
              <span>Cancelar</span>
            </Button>
          )}
          {!isSecond && (
            <Link href={`/tarefas/${task.id}`}>
              <ChevronRight size={16} className="text-muted-foreground" />
            </Link>
          )}
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
            <p className="font-medium">Suíte {task.rooms.number}</p>
            <p className="text-xs text-muted-foreground">
              {taskTypeLabel(task.task_type, task.extra_cleaning)}
              {isPast && ` · ${formatDateShortPt(task.date)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={task.status === "concluido" ? "default" : "secondary"}>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          {href && <ChevronRight size={16} className="text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import type { DailyRoomTask, Profile } from "@/lib/types";
import { claimTask } from "@/lib/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BedDouble, ChevronRight, Hand } from "lucide-react";

export type TaskWithRoom = DailyRoomTask & { rooms: { number: string; name: string | null } };

export function TasksBoard({ profile, tasks }: { profile: Profile; tasks: TaskWithRoom[] }) {
  if (profile.role !== "camareira") {
    // Visão simples para o admin (referência), sem ações de escolha.
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="text-muted-foreground text-sm py-8 col-span-2 text-center">
            Nenhum quarto planejado para hoje.
          </p>
        )}
      </div>
    );
  }

  const available = tasks.filter((t) => !t.assigned_to && t.status !== "concluido");
  const mine = tasks.filter((t) => t.assigned_to === profile.id);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Disponíveis para escolher</h2>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum quarto disponível no momento — todos já foram escolhidos.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {available.map((task) => (
              <AvailableTaskCard key={task.id} task={task} />
            ))}
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
              <TaskCard key={task.id} task={task} href={`/tarefas/${task.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AvailableTaskCard({ task }: { task: TaskWithRoom }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
            <BedDouble size={18} />
          </div>
          <div>
            <p className="font-medium">Quarto {task.rooms.number}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {task.task_type === "arrumacao" ? "Arrumação" : "Preparação"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
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
          <Hand size={14} /> Escolher
        </Button>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task, href }: { task: TaskWithRoom; href?: string }) {
  const content = (
    <Card className={href ? "hover:border-primary transition-colors" : undefined}>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
            <BedDouble size={18} />
          </div>
          <div>
            <p className="font-medium">Quarto {task.rooms.number}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {task.task_type === "arrumacao" ? "Arrumação" : "Preparação"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

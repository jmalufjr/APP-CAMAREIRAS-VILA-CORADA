"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Room, Profile, DailyRoomTask, ChecklistType } from "@/lib/types";
import { taskStatusLabel } from "@/lib/types";
import { setRoomTask, setTaskReviewRequired, setTaskExtraCleaning } from "@/lib/actions/planning";
import { TASK_TYPE_LABELS, TASK_TYPE_OPTIONS } from "@/lib/task-type";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export function PlanningBoard({
  date,
  rooms,
  camareiras,
  tasks,
}: {
  date: string;
  rooms: Room[];
  camareiras: Profile[];
  tasks: DailyRoomTask[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const taskByRoom = new Map(tasks.map((t) => [t.room_id, t]));
  const camareiraById = new Map(camareiras.map((c) => [c.id, c.name]));

  function handleTaskTypeChange(roomId: string, value: string | null) {
    const taskType = !value || value === "none" ? null : (value as ChecklistType);
    startTransition(async () => {
      const result = await setRoomTask(date, roomId, taskType);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleReviewToggle(taskId: string, value: boolean) {
    startTransition(async () => {
      const result = await setTaskReviewRequired(taskId, value);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleExtraToggle(taskId: string, value: boolean) {
    startTransition(async () => {
      const result = await setTaskExtraCleaning(taskId, value);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Suíte</TableHead>
            <TableHead>Trabalho do dia</TableHead>
            <TableHead>Limpeza adicional</TableHead>
            <TableHead>Revisão</TableHead>
            <TableHead>Camareira responsável</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((room) => {
            const task = taskByRoom.get(room.id);
            const camareiraName = task?.assigned_to ? camareiraById.get(task.assigned_to) : null;
            return (
              <TableRow key={room.id}>
                <TableCell className="font-medium">{room.number}</TableCell>
                <TableCell>
                  <Select
                    value={task?.task_type ?? "none"}
                    onValueChange={(v) => handleTaskTypeChange(room.id, v)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue>
                        {(v: string) => (v === "none" ? "Sem trabalho" : TASK_TYPE_LABELS[v as ChecklistType])}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem trabalho</SelectItem>
                      {TASK_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {task && ["troca", "preparacao", "somente_saida"].includes(task.task_type) ? (
                    <Switch
                      checked={task.extra_cleaning}
                      disabled={isPending || task.status !== "pendente" || !!task.assigned_to}
                      onCheckedChange={(v) => handleExtraToggle(task.id, v)}
                      aria-label="Limpeza adicional"
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task ? (
                    <Switch
                      checked={task.review_required}
                      disabled={isPending || (task.status !== "pendente" && task.status !== "em_andamento")}
                      onCheckedChange={(v) => handleReviewToggle(task.id, v)}
                      aria-label="Revisão"
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {!task ? (
                    <span className="text-muted-foreground text-sm">—</span>
                  ) : camareiraName ? (
                    <Badge variant={task.status === "concluido" ? "default" : "outline"}>
                      {camareiraName}
                      {task.second_assigned_to && ` e ${camareiraById.get(task.second_assigned_to) ?? "2ª camareira"}`}
                      {task.status === "concluido" && " · entregue"}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Aguardando escolha</span>
                  )}
                </TableCell>
                <TableCell>
                  {task ? (
                    <Badge variant={task.status === "concluido" ? "default" : "secondary"}>
                      {taskStatusLabel(task)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

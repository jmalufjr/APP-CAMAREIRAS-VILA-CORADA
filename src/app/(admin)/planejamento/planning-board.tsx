"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Room, Profile, DailyRoomTask, ChecklistType } from "@/lib/types";
import { setRoomTask, assignCamareira } from "@/lib/actions/planning";
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

  function handleTaskTypeChange(roomId: string, value: string | null) {
    const taskType = !value || value === "none" ? null : (value as ChecklistType);
    const existing = taskByRoom.get(roomId);
    startTransition(async () => {
      const result = await setRoomTask(date, roomId, taskType, existing?.assigned_to ?? null);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleAssignChange(taskId: string, value: string | null) {
    startTransition(async () => {
      const result = await assignCamareira(taskId, !value || value === "none" ? null : value);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quarto</TableHead>
            <TableHead>Trabalho do dia</TableHead>
            <TableHead>Camareira responsável</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((room) => {
            const task = taskByRoom.get(room.id);
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem trabalho</SelectItem>
                      <SelectItem value="arrumacao">Arrumação</SelectItem>
                      <SelectItem value="preparacao">Preparação</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {task ? (
                    <Select
                      value={task.assigned_to ?? "none"}
                      onValueChange={(v) => handleAssignChange(task.id, v)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não atribuído</SelectItem>
                        {camareiras.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task ? (
                    <Badge variant={task.status === "concluido" ? "default" : "secondary"}>
                      {task.status === "concluido"
                        ? "Concluído"
                        : task.status === "em_andamento"
                        ? "Em andamento"
                        : "Pendente"}
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

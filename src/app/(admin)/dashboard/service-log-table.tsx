"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatDateShortPt, formatTimePt, formatDurationPt, effectiveServiceStart } from "@/lib/date";
import type { ChecklistType } from "@/lib/types";

export interface ServiceLogRow {
  id: string;
  date: string;
  room_number: string;
  task_type: ChecklistType;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  camareira_name: string | null;
}

export function ServiceLogTable({ rows }: { rows: ServiceLogRow[] }) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Suíte</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Camareira</TableHead>
          <TableHead>Início</TableHead>
          <TableHead>Término</TableHead>
          <TableHead>Duração</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const inicio = effectiveServiceStart(r.claimed_at, r.started_at);
          return (
            <TableRow
              key={r.id}
              className="cursor-pointer hover:bg-accent"
              onClick={() => router.push(`/dashboard/tarefas/${r.id}`)}
            >
              <TableCell>{formatDateShortPt(r.date)}</TableCell>
              <TableCell>{r.room_number}</TableCell>
              <TableCell>{TASK_TYPE_LABELS[r.task_type]}</TableCell>
              <TableCell>{r.camareira_name ?? "—"}</TableCell>
              <TableCell>{inicio ? formatTimePt(inicio) : "—"}</TableCell>
              <TableCell>{r.finished_at ? formatTimePt(r.finished_at) : "—"}</TableCell>
              <TableCell>{formatDurationPt(inicio, r.finished_at)}</TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
              Nenhum serviço concluído nos últimos 7 dias.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

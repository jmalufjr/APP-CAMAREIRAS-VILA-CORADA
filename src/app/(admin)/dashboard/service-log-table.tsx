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
  // Revisão e correção (camareira revisora).
  reviewer_name: string | null;
  review_waived: boolean;
  review_claimed_at: string | null;
  review_finished_at: string | null;
  correction_started_at: string | null;
  correction_finished_at: string | null;
}

export function ServiceLogTable({ rows, emptyText }: { rows: ServiceLogRow[]; emptyText?: string }) {
  const router = useRouter();
  const time = (iso: string | null) => (iso ? formatTimePt(iso) : "—");

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
          <TableHead>Revisora</TableHead>
          <TableHead>Início revisão</TableHead>
          <TableHead>Término revisão</TableHead>
          <TableHead>Duração revisão</TableHead>
          <TableHead>Início correção</TableHead>
          <TableHead>Término correção</TableHead>
          <TableHead>Duração correção</TableHead>
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
              <TableCell>{time(inicio)}</TableCell>
              <TableCell>{time(r.finished_at)}</TableCell>
              <TableCell>{formatDurationPt(inicio, r.finished_at)}</TableCell>
              <TableCell>{r.review_waived ? "Dispensada" : r.reviewer_name ?? "—"}</TableCell>
              <TableCell>{time(r.review_claimed_at)}</TableCell>
              <TableCell>{time(r.review_finished_at)}</TableCell>
              <TableCell>{formatDurationPt(r.review_claimed_at, r.review_finished_at)}</TableCell>
              <TableCell>{time(r.correction_started_at)}</TableCell>
              <TableCell>{time(r.correction_finished_at)}</TableCell>
              <TableCell>{formatDurationPt(r.correction_started_at, r.correction_finished_at)}</TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={14} className="text-center text-muted-foreground py-6">
              {emptyText ?? "Nenhum serviço concluído nos últimos 7 dias."}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatDateShortPt } from "@/lib/date";
import type { ChecklistType } from "@/lib/types";

export interface ServiceLogRow {
  id: string;
  date: string;
  room_number: string;
  task_type: ChecklistType;
  status: "concluido" | "cancelado";
  camareira_name: string | null;
  cancelled_by_name: string | null;
}

export function ServiceLogTable({ rows }: { rows: ServiceLogRow[] }) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Quarto</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Camareira</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const isConcluido = r.status === "concluido";
          return (
            <TableRow
              key={r.id}
              className={isConcluido ? "cursor-pointer hover:bg-accent" : undefined}
              onClick={isConcluido ? () => router.push(`/dashboard/tarefas/${r.id}`) : undefined}
            >
              <TableCell>{formatDateShortPt(r.date)}</TableCell>
              <TableCell>{r.room_number}</TableCell>
              <TableCell>{TASK_TYPE_LABELS[r.task_type]}</TableCell>
              <TableCell>
                {isConcluido ? (
                  r.camareira_name ?? "—"
                ) : (
                  <span className="text-muted-foreground">Cancelado por {r.cancelled_by_name ?? "—"}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
              Nenhum serviço concluído ou cancelado nos últimos 7 dias.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

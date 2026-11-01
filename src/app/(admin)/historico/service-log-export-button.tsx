"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv-export";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import { formatTimePt, formatDurationPt, effectiveServiceStart } from "@/lib/date";
import type { ServiceLogRow } from "@/app/(admin)/dashboard/service-log-table";

// Exporta a tabela "Serviços no período" (execução, revisão e correção) em CSV.
export function ServiceLogExportButton({ rows }: { rows: ServiceLogRow[] }) {
  const time = (iso: string | null) => (iso ? formatTimePt(iso) : "");
  const dur = (a: string | null, b: string | null) => {
    const d = formatDurationPt(a, b);
    return d === "—" ? "" : d;
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        downloadCsv("historico-servicos.csv", [
          [
            "Data",
            "Suíte",
            "Tipo",
            "Camareira",
            "Início",
            "Término",
            "Duração",
            "Revisora",
            "Início revisão",
            "Término revisão",
            "Duração revisão",
            "Início correção",
            "Término correção",
            "Duração correção",
          ],
          ...rows.map((r) => {
            const inicio = effectiveServiceStart(r.claimed_at, r.started_at);
            return [
              r.date,
              r.room_number,
              TASK_TYPE_LABELS[r.task_type],
              r.camareira_name ?? "",
              time(inicio),
              time(r.finished_at),
              dur(inicio, r.finished_at),
              r.review_waived ? "Dispensada" : r.reviewer_name ?? "",
              time(r.review_claimed_at),
              time(r.review_finished_at),
              dur(r.review_claimed_at, r.review_finished_at),
              time(r.correction_started_at),
              time(r.correction_finished_at),
              dur(r.correction_started_at, r.correction_finished_at),
            ];
          }),
        ])
      }
    >
      <Download size={14} /> Exportar CSV
    </Button>
  );
}

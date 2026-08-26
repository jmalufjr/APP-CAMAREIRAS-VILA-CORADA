import { PageHeader } from "@/components/shared/page-header";
import { WeekMaintenanceTable } from "@/components/shared/week-maintenance-table";
import { getMaintenanceRangeRows } from "@/lib/actions/maintenance";
import { fridayKey, formatDateRangePt } from "@/lib/date";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ManutencaoPreventivaSemanaPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const weekEnd = fridayKey(weekStart);
  const rows = await getMaintenanceRangeRows(weekStart, weekEnd);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pendentes, selecionadas e concluídas"
        subtitle={`Semana de ${formatDateRangePt(weekStart, weekEnd)} (segunda a sexta-feira).`}
        action={
          <Link
            href="/manutencao-preventiva"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={15} /> Voltar
          </Link>
        }
      />
      <WeekMaintenanceTable rows={rows} />
    </div>
  );
}

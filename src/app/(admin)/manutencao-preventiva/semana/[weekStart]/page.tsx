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
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/20 dark:border-[#E8B85C]/50 dark:bg-[#E8B85C]/10 dark:text-[#E8B85C] dark:hover:bg-[#E8B85C]/20"
          >
            <ArrowLeft size={16} strokeWidth={2.25} /> Voltar
          </Link>
        }
      />
      <WeekMaintenanceTable rows={rows} />
    </div>
  );
}

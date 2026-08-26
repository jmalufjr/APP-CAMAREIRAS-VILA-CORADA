import { PageHeader } from "@/components/shared/page-header";
import { getMaintenanceCategoryDetail } from "@/lib/actions/maintenance";
import { fridayKey, formatDateRangePt } from "@/lib/date";
import { MaintenanceChecklistDetail } from "./maintenance-checklist-detail";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ManutencaoPreventivaCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string; weekStart: string }>;
}) {
  const { categoryId, weekStart } = await params;
  const weekEnd = fridayKey(weekStart);
  const detail = await getMaintenanceCategoryDetail(categoryId, weekStart, weekEnd);

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.category_name}
        subtitle={`Checklist de manutenção preventiva · semana de ${formatDateRangePt(weekStart, weekEnd)}`}
        action={
          <Link
            href="/manutencao/preventiva"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={15} /> Voltar
          </Link>
        }
      />
      <MaintenanceChecklistDetail
        categoryId={categoryId}
        weekStart={weekStart}
        weekEnd={weekEnd}
        naoTecnico={detail.naoTecnico}
        tecnico={detail.tecnico}
      />
    </div>
  );
}

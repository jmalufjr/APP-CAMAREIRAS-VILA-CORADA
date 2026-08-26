import { PageHeader } from "@/components/shared/page-header";
import { getMaintenanceCategoryDetail } from "@/lib/actions/maintenance";
import { MaintenanceChecklistDetail } from "./maintenance-checklist-detail";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ManutencaoPreventivaCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const detail = await getMaintenanceCategoryDetail(categoryId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.category_name}
        subtitle="Checklist de manutenção preventiva"
        action={
          <Link
            href="/manutencao/preventiva"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={15} /> Voltar
          </Link>
        }
      />
      <MaintenanceChecklistDetail categoryId={categoryId} naoTecnico={detail.naoTecnico} tecnico={detail.tecnico} />
    </div>
  );
}

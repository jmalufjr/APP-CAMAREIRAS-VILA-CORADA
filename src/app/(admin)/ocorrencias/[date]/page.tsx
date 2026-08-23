import { PageHeader } from "@/components/shared/page-header";
import { formatDatePt } from "@/lib/date";
import { getOccurrencesForDates } from "@/lib/actions/occurrences";
import { OccurrenceList } from "../occurrence-list";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function OcorrenciasDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const items = await getOccurrencesForDates([date]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ocorrências Manutenção e observações"
        subtitle={formatDatePt(date)}
        action={
          <Link
            href="/ocorrencias/historico"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={15} /> Voltar ao histórico
          </Link>
        }
      />
      <OccurrenceList items={items} />
    </div>
  );
}

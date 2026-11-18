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
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/20 dark:border-[#E8B85C]/50 dark:bg-[#E8B85C]/10 dark:text-[#E8B85C] dark:hover:bg-[#E8B85C]/20"
          >
            <ArrowLeft size={16} strokeWidth={2.25} /> Voltar ao histórico
          </Link>
        }
      />
      <OccurrenceList items={items} />
    </div>
  );
}

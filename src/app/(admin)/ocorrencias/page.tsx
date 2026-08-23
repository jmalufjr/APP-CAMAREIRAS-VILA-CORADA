import { PageHeader } from "@/components/shared/page-header";
import { todayKey, yesterdayKey, formatDatePt } from "@/lib/date";
import { getOccurrencesForDates } from "@/lib/actions/occurrences";
import { OccurrenceList } from "./occurrence-list";
import Link from "next/link";
import { History } from "lucide-react";

export default async function OcorrenciasPage() {
  const today = todayKey();
  const yesterday = yesterdayKey();
  const items = await getOccurrencesForDates([today, yesterday]);

  const byDate = new Map<string, typeof items>();
  items.forEach((t) => {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ocorrências Manutenção e observações"
        subtitle="Detalhes de hoje e de ontem, por quarto."
        action={
          <Link
            href="/ocorrencias/historico"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <History size={15} /> Ver histórico de 30 dias
          </Link>
        }
      />

      {[today, yesterday].map((date) => (
        <div key={date} className="space-y-3">
          <h2 className="font-heading text-lg text-primary capitalize">{formatDatePt(date)}</h2>
          <OccurrenceList items={byDate.get(date) ?? []} />
        </div>
      ))}
    </div>
  );
}

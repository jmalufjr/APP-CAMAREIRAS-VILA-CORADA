import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReviewTopics, type TopicRow } from "@/lib/actions/stays-reviews";
import { ReadPendingButton } from "./read-pending-button";

function TopicsTable({ title, rows, empty }: { title: string; rows: TopicRow[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">
          {title} · {rows.length} assunto(s)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Assunto</th>
                <th className="py-1 text-right font-medium">Vezes citado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="py-1.5">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AvaliacoesTemasPage() {
  const result = await getReviewTopics();

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/avaliacoes-hospedes" />
        <PageHeader title="Assuntos citados pelos hóspedes" subtitle="Leitura dos comentários pela IA." />
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/avaliacoes-hospedes" />
      <PageHeader
        title="Assuntos citados pelos hóspedes"
        subtitle="A IA lê os comentários e resume cada assunto numa descrição curta. A contagem é de quantas vezes o assunto foi citado, separada em positivos e negativos. Os comentários novos são lidos a cada sincronização com a Stays."
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {result.totalRead} avaliações lidas · {result.pending} aguardando leitura
        </span>
        <ReadPendingButton pending={result.pending} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TopicsTable title="Positivos" rows={result.positive} empty="Nenhum assunto positivo ainda." />
        <TopicsTable title="Negativos" rows={result.negative} empty="Nenhum assunto negativo ainda." />
      </div>
    </div>
  );
}

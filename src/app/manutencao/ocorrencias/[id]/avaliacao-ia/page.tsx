import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOccurrenceAssessment, youtubeSearchUrl } from "@/lib/occurrence-ai";
import { formatDateTimePt } from "@/lib/date";
import { RegenerateButton } from "./regenerate-button";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AvaliacaoIaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const view = await getOccurrenceAssessment(id);
  if (!view) notFound();
  const { occurrence, assessment } = view;

  return (
    <div className="space-y-6">
      <BackLink href="/manutencao/ocorrencias" />
      <PageHeader
        title="Avaliação da Inteligência Artificial"
        subtitle={`${occurrence.roomNumber ? `Suíte ${occurrence.roomNumber} · ` : ""}${occurrence.category}${occurrence.description ? ` — ${occurrence.description}` : ""}`}
      />

      {occurrence.photos.some((p) => p.url) && (
        <div className="flex flex-wrap gap-2">
          {occurrence.photos.map(
            (p) =>
              p.url && (
                <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="Foto da ocorrência" className="h-24 w-24 rounded-lg object-cover border border-border" />
                </a>
              )
          )}
        </div>
      )}

      {view.error && <p className="text-sm text-destructive">{view.error}</p>}

      {assessment && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Possível problema</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base">{assessment.problem}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Possível solução</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold mb-1">Procedimento</p>
                <ol className="list-decimal space-y-1 pl-5">
                  {assessment.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              {assessment.materials.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Materiais</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {assessment.materials.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {assessment.tools.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Ferramentas</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {assessment.tools.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {assessment.safety && (
                <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                  <strong>Atenção:</strong> {assessment.safety}
                </p>
              )}
              {assessment.videoSearch && (
                <p>
                  <a
                    href={youtubeSearchUrl(assessment.videoSearch)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline dark:text-[#E8B85C]"
                  >
                    Ver vídeos no YouTube: “{assessment.videoSearch}”
                  </a>
                </p>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Avaliação gerada por inteligência artificial{view.assessedAt ? ` em ${formatDateTimePt(view.assessedAt)}` : ""} a partir da descrição e das fotos. É uma sugestão: confirme o problema no local antes de agir.
          </p>
        </>
      )}
      <RegenerateButton occurrenceId={occurrence.id} />
    </div>
  );
}

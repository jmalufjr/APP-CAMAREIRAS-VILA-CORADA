import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGuestReviews } from "@/lib/actions/stays-reviews";
import { channelsPresent, overallAverage } from "@/lib/stays/reviews";
import { formatDatePt } from "@/lib/date";

const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));

export default async function AvaliacoesPage() {
  const result = await getGuestReviews();

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard" />
        <PageHeader title="Avaliações de hóspedes" subtitle="Todas as avaliações disponíveis na Stays." />
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  const { reviews } = result;
  const channels = channelsPresent(reviews);

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Avaliações de hóspedes"
        subtitle={`${reviews.length} avaliações disponíveis na Stays, da mais recente para a mais antiga. Notas de 0 a 5 (as do Booking, que vêm de 0 a 10, foram divididas por 2).`}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">Todas: {reviews.length} · média {fmt(overallAverage(reviews))}</Badge>
        {channels.map((c) => {
          const list = reviews.filter((r) => r.channel === c);
          return (
            <Badge key={c} variant="outline">
              {list[0].channelLabel}: {list.length} · média {fmt(overallAverage(list))}
            </Badge>
          );
        })}
      </div>

      {reviews.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma avaliação encontrada.</p>}

      <div className="space-y-3">
        {reviews.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{formatDatePt(r.day)}</span>
                <Badge variant="secondary">{r.channelLabel}</Badge>
                <span>Suíte {r.suite ?? "—"}</span>
                {r.guestName && <span className="text-muted-foreground">{r.guestName}</span>}
                {r.reservationCode && <span className="text-xs text-muted-foreground">Reserva {r.reservationCode}</span>}
                <span className="ml-auto font-heading text-lg text-primary">Nota {fmt(r.rating)}</span>
              </div>

              {r.items.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {r.items.map((i) => (
                    <span key={i.key}>
                      {i.label}: <strong className="text-foreground">{fmt(i.value)}</strong>
                    </span>
                  ))}
                </div>
              )}

              {r.comments.length > 0 ? (
                <div className="space-y-1.5 text-sm">
                  {r.comments.map((c, idx) => (
                    <p key={idx} className="whitespace-pre-wrap">
                      <span className="text-xs font-medium text-muted-foreground">{c.label}: </span>
                      {c.text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sem comentários.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

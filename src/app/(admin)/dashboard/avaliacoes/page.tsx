import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGuestReviews, type StoredReview } from "@/lib/actions/stays-reviews";
import { channelsPresent, overallAverage } from "@/lib/stays/reviews";
import { formatDatePt, formatDateTimePt } from "@/lib/date";
import { ReplyBox } from "./reply-box";

const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));

function ReviewCard({ r }: { r: StoredReview }) {
  return (
    <Card>
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

        <ReplyBox
          reviewId={r.id}
          initialText={r.replyText}
          repliedByName={r.repliedByName}
          repliedAtLabel={r.repliedAt ? formatDateTimePt(r.repliedAt) : null}
        />
      </CardContent>
    </Card>
  );
}

export default async function AvaliacoesPage() {
  const result = await getGuestReviews();

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard/avaliacoes-hospedes" />
        <PageHeader title="Avaliações: conteúdo e resposta" subtitle="Todas as avaliações disponíveis na Stays." />
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  const { reviews } = result;
  const channels = channelsPresent(reviews);
  const fresh = reviews.filter((r) => r.isNew);
  const others = reviews.filter((r) => !r.isNew);

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/avaliacoes-hospedes" />
      <PageHeader
        title="Avaliações: conteúdo e resposta"
        subtitle={`${reviews.length} avaliações. Notas de 0 a 5 (as do Booking, que vêm de 0 a 10, foram divididas por 2). A lista é atualizada a cada sincronização com a Stays, manual ou automática.`}
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

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Avaliações novas · {fresh.length}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            As que chegaram nos últimos 7 dias, nas sincronizações com a Stays (a automática diária ou a manual).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {fresh.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação nova nos últimos 7 dias.</p>
          ) : (
            fresh.map((r) => <ReviewCard key={r.id} r={r} />)
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Demais avaliações · {others.length}</h2>
        {others.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma outra avaliação.</p>}
        {others.map((r) => (
          <ReviewCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

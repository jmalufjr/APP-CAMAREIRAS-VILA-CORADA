"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StoredReview } from "@/lib/actions/stays-reviews";
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

// Lista com filtro por canal: as "barras" de resumo (Todas, Booking, Airbnb...) são botões.
export function ReviewsList({ reviews }: { reviews: StoredReview[] }) {
  const [filter, setFilter] = useState<string>("all");
  const channels = channelsPresent(reviews);

  const visible = filter === "all" ? reviews : reviews.filter((r) => r.channel === filter);
  const fresh = visible.filter((r) => r.isNew);
  const others = visible.filter((r) => !r.isNew);

  const chip = (key: string, label: string, list: StoredReview[]) => {
    const active = filter === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setFilter(key)}
        aria-pressed={active}
        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {label}: {list.length} · média {fmt(overallAverage(list))}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {chip("all", "Todas", reviews)}
        {channels.map((c) => {
          const list = reviews.filter((r) => r.channel === c);
          return chip(c, list[0].channelLabel, list);
        })}
      </div>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Avaliações novas · {fresh.length}</CardTitle>
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/actions/authz";
import { syncStaysGuestReviews } from "@/lib/actions/stays-sync";
import { extractTopicsForPending } from "@/lib/review-topics";
import type { NormalizedReview, ReviewItemScore } from "@/lib/stays/reviews";
import { channelLabel } from "@/lib/stays/reviews";

export interface StoredReview extends NormalizedReview {
  firstSeenAt: string;
  // Chegou na cópia (sincronização) nos últimos 7 dias.
  isNew: boolean;
  replyText: string | null;
  repliedAt: string | null;
  repliedByName: string | null;
}

const ROLES = ["admin", "gerente_operacional"] as const;

// Avaliações guardadas no app (copiadas da Stays a cada sincronização), da mais recente para a mais
// antiga. Se a cópia ainda estiver vazia (primeira vez), faz a importação na hora.
export async function getGuestReviews(): Promise<
  { error: string } | { reviews: StoredReview[]; suites: { number: string }[] }
> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;

  const supabase = await createClient();
  const countRes = await supabase.from("guest_reviews").select("id", { count: "exact", head: true });
  if (countRes.error) return { error: countRes.error.message };
  if ((countRes.count ?? 0) === 0) {
    const first = await syncStaysGuestReviews();
    if ("error" in first && first.error) return { error: first.error };
  }

  const [{ data, error }, { data: rooms }] = await Promise.all([
    supabase
      .from("guest_reviews")
      .select(
        "id, day, channel, suite_number, guest_name, reservation_code, stays_status, rating, items, comments, first_seen_at, reply_text, replied_at, replied_by_profile:profiles!guest_reviews_replied_by_fkey(name)"
      )
      .order("day", { ascending: false })
      .order("first_seen_at", { ascending: false })
      .order("id", { ascending: false }),
    supabase.from("rooms").select("number"),
  ]);
  if (error) return { error: error.message };

  type Raw = {
    id: string;
    day: string;
    channel: string;
    suite_number: string | null;
    guest_name: string | null;
    reservation_code: string | null;
    stays_status: string | null;
    rating: number | null;
    items: ReviewItemScore[];
    comments: { label: string; text: string }[];
    first_seen_at: string;
    reply_text: string | null;
    replied_at: string | null;
    replied_by_profile: { name: string } | null;
  };
  const newSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const reviews: StoredReview[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    day: r.day,
    channel: r.channel,
    channelLabel: channelLabel(r.channel),
    suite: r.suite_number,
    guestName: r.guest_name,
    reservationCode: r.reservation_code,
    status: r.stays_status,
    rating: r.rating === null ? null : Number(r.rating),
    items: r.items ?? [],
    comments: r.comments ?? [],
    firstSeenAt: r.first_seen_at,
    isNew: new Date(r.first_seen_at).getTime() >= newSince,
    replyText: r.reply_text,
    repliedAt: r.replied_at,
    repliedByName: r.replied_by_profile?.name ?? null,
  }));
  const suites = (rooms ?? [])
    .map((r) => ({ number: String(Number(r.number) || r.number) }))
    .sort((a, b) => Number(a.number) - Number(b.number));
  return { reviews, suites };
}

// Resposta registrada no app pelo admin/gerente (não é publicada no Booking/Airbnb: a API da Stays
// não documenta como responder). Texto vazio apaga a resposta.
export async function saveReviewReply(reviewId: string, text: string) {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const clean = text.trim();
  const { data, error } = await createAdminClient()
    .from("guest_reviews")
    .update(
      clean
        ? { reply_text: clean, replied_by: user.id, replied_at: new Date().toISOString() }
        : { reply_text: null, replied_by: null, replied_at: null }
    )
    .eq("id", reviewId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Avaliação não encontrada." };

  revalidatePath("/dashboard/avaliacoes");
  return { success: true };
}

export interface TopicRow {
  label: string;
  count: number; // em quantas avaliações o assunto foi citado
}

// Assuntos citados nos comentários, já somados, separados em positivos e negativos.
export async function getReviewTopics(): Promise<
  { error: string } | { positive: TopicRow[]; negative: TopicRow[]; pending: number; totalRead: number }
> {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;

  const supabase = await createClient();
  // Garante que a cópia das avaliações existe (primeira vez).
  const countRes = await supabase.from("guest_reviews").select("id", { count: "exact", head: true });
  if (countRes.error) return { error: countRes.error.message };
  if ((countRes.count ?? 0) === 0) {
    const first = await syncStaysGuestReviews();
    if ("error" in first && first.error) return { error: first.error };
  }

  const all: { label: string; polarity: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("guest_review_topics").select("label, polarity").range(from, from + 999);
    if (error) return { error: error.message };
    all.push(...((data ?? []) as { label: string; polarity: string }[]));
    if (!data || data.length < 1000) break;
  }

  const tally = (polarity: string): TopicRow[] => {
    const map = new Map<string, { label: string; count: number }>();
    all
      .filter((t) => t.polarity === polarity)
      .forEach((t) => {
        const key = t.label.trim().toLowerCase();
        const cur = map.get(key) ?? { label: t.label, count: 0 };
        cur.count += 1;
        map.set(key, cur);
      });
    return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };

  const [{ count: pending }, { count: total }] = await Promise.all([
    supabase.from("guest_reviews").select("id", { count: "exact", head: true }).is("topics_read_at", null),
    supabase.from("guest_reviews").select("id", { count: "exact", head: true }),
  ]);
  return { positive: tally("positivo"), negative: tally("negativo"), pending: pending ?? 0, totalRead: (total ?? 0) - (pending ?? 0) };
}

// Botão "Ler comentários pendentes com a IA" da tela de assuntos.
export async function processPendingReviewTopics() {
  const denied = await requireRole([...ROLES]);
  if (denied) return denied;
  const result = await extractTopicsForPending(createAdminClient(), 60);
  revalidatePath("/dashboard/avaliacoes-temas");
  return result.error ? { error: result.error, processed: result.processed, remaining: result.remaining } : { success: true as const, processed: result.processed, remaining: result.remaining };
}

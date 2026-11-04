"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/authz";
import { getStaysGuestReviews } from "@/lib/stays/client";
import { normalizeReview, type NormalizedReview } from "@/lib/stays/reviews";
import { todayKey } from "@/lib/date";

// Todas as avaliações de hóspedes disponíveis na Stays, já normalizadas (canal, suíte, notas por
// item numa escala de 0 a 5, comentários) e da mais recente para a mais antiga. Só leitura.
export async function getGuestReviews(): Promise<
  { error: string } | { reviews: NormalizedReview[]; suites: { number: string }[] }
> {
  const denied = await requireRole(["admin"]);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: rooms } = await supabase.from("rooms").select("number, stays_listing_id");
  const suiteByListing = new Map<string, string>();
  (rooms ?? []).forEach((r) => {
    if (r.stays_listing_id) suiteByListing.set(r.stays_listing_id as string, String(Number(r.number) || r.number));
  });
  const suites = (rooms ?? [])
    .map((r) => ({ number: String(Number(r.number) || r.number) }))
    .sort((a, b) => Number(a.number) - Number(b.number));

  try {
    const raw = await getStaysGuestReviews(todayKey());
    const reviews = raw.map((r) => normalizeReview(r, suiteByListing)).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
    return { reviews, suites };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao consultar as avaliações na Stays." };
  }
}

// Regras puras das avaliações de hóspedes vindas da Stays: normaliza cada avaliação (canal, suíte,
// notas por item numa escala única de 0 a 5, comentários) e calcula as médias. Sem I/O.
import type { StaysReviewRaw } from "@/lib/stays/client";

export interface ReviewItemScore {
  key: string;
  label: string;
  value: number; // 0 a 5
}

export interface NormalizedReview {
  id: string;
  day: string;
  channel: string; // chave: bookingcom, expedia, internal, airbnb...
  channelLabel: string;
  suite: string | null; // número da suíte ("1".."11")
  guestName: string | null;
  reservationCode: string | null;
  status: string | null;
  rating: number | null; // nota geral, 0 a 5
  items: ReviewItemScore[];
  comments: { label: string; text: string }[];
}

const CHANNEL_LABELS: Record<string, string> = {
  bookingcom: "Booking",
  expedia: "Expedia",
  airbnb: "Airbnb",
  decolar: "Decolar/Despegar",
  despegar: "Decolar/Despegar",
  internal: "Avaliação interna (Stays)",
};
export const CHANNEL_ORDER = ["bookingcom", "airbnb", "expedia", "decolar", "despegar", "internal"];

export function channelLabel(source: string): string {
  return CHANNEL_LABELS[source] ?? source;
}

// Campo da Stays -> nome do item. Booking vem em 0 a 10 (divide por 2); os demais já em 0 a 5.
// Valor 0 = "não avaliado" (ex.: Booking sem nota de serviços), por isso fica fora das médias.
const ITEM_DEFS: Record<string, { field: string; label: string; divisor: number }[]> = {
  internal: [
    { field: "cleaningRating", label: "Limpeza", divisor: 1 },
    { field: "checkinRating", label: "Check-in", divisor: 1 },
    { field: "checkoutRating", label: "Check-out", divisor: 1 },
    { field: "reservationRating", label: "Reserva", divisor: 1 },
    { field: "maintenanceRating", label: "Manutenção", divisor: 1 },
    { field: "treatmentRating", label: "Atendimento", divisor: 1 },
  ],
  bookingcom: [
    { field: "originalCleanRating", label: "Limpeza", divisor: 2 },
    { field: "originalFacilitiesRating", label: "Instalações", divisor: 2 },
    { field: "originalLocationRating", label: "Localização", divisor: 2 },
    { field: "originalServicesRating", label: "Serviços", divisor: 2 },
    { field: "originalStaffRating", label: "Equipe", divisor: 2 },
    { field: "originalValueRating", label: "Custo-benefício", divisor: 2 },
  ],
  airbnb: [
    { field: "cleanlinessRating", label: "Limpeza", divisor: 1 },
    { field: "accuracyRating", label: "Fidelidade ao anúncio", divisor: 1 },
    { field: "checkinRating", label: "Check-in", divisor: 1 },
    { field: "communicationRating", label: "Comunicação", divisor: 1 },
    { field: "locationRating", label: "Localização", divisor: 1 },
    { field: "valueRating", label: "Custo-benefício", divisor: 1 },
  ],
  expedia: [
    { field: "roomCleanRating", label: "Limpeza do quarto", divisor: 1 },
    { field: "roomAmenitiesScoreRating", label: "Conforto do quarto", divisor: 1 },
    { field: "hotelConditionRating", label: "Estado do local", divisor: 1 },
    { field: "communicationRating", label: "Comunicação", divisor: 1 },
    { field: "ecoFriendlinessRating", label: "Sustentabilidade", divisor: 1 },
    { field: "overallRating", label: "Experiência geral", divisor: 1 },
  ],
};

const COMMENT_FIELDS: { field: string; label: string }[] = [
  { field: "headlineComment", label: "Título" },
  { field: "positiveComment", label: "O que gostou" },
  { field: "positiveTraits", label: "O que gostou" },
  { field: "negativeComment", label: "O que não gostou" },
  { field: "negativeTraits", label: "O que não gostou" },
  { field: "reviewText", label: "Comentário" },
  { field: "publicReview", label: "Comentário" },
  { field: "accuracyComment", label: "Sobre a fidelidade ao anúncio" },
  { field: "privateFeedback", label: "Feedback privado" },
  { field: "hostResponse", label: "Resposta da pousada" },
];

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// `suiteByListing`: _id do imóvel na Stays -> número da suíte (rooms.stays_listing_id).
export function normalizeReview(raw: StaysReviewRaw, suiteByListing: Map<string, string>): NormalizedReview {
  const defs = ITEM_DEFS[raw.source] ?? [];
  const items: ReviewItemScore[] = [];
  defs.forEach((d) => {
    const v = num(raw[d.field]) / d.divisor;
    if (v > 0) items.push({ key: d.label, label: d.label, value: Math.round(v * 100) / 100 });
  });

  const comments: { label: string; text: string }[] = [];
  COMMENT_FIELDS.forEach((c) => {
    const t = str(raw[c.field]);
    if (t) comments.push({ label: c.label, text: t });
  });

  const listingId = raw.apartment?._id ?? "";
  const avatarDigits = (raw.apartment?.avatar ?? "").match(/\d+/)?.[0];
  const suite = suiteByListing.get(listingId) ?? (avatarDigits ? String(Number(avatarDigits)) : null);
  const rating = num(raw.rating);

  return {
    id: raw._id,
    day: raw.day,
    channel: raw.source,
    channelLabel: channelLabel(raw.source),
    suite,
    guestName: raw.client?.fName ?? null,
    reservationCode: raw.reserve?.id ?? null,
    status: typeof raw.status === "string" ? raw.status : null,
    rating: rating > 0 ? rating : null,
    items,
    comments,
  };
}

export interface ItemAverage {
  label: string;
  average: number;
  count: number;
}
export interface ChannelAverage {
  channel: string;
  channelLabel: string;
  average: number | null;
  count: number;
  items: ItemAverage[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Média geral e por item de um conjunto de avaliações do MESMO canal.
export function channelAverage(reviews: NormalizedReview[], channel: string): ChannelAverage {
  const mine = reviews.filter((r) => r.channel === channel);
  const byItem = new Map<string, number[]>();
  mine.forEach((r) => r.items.forEach((i) => byItem.set(i.label, [...(byItem.get(i.label) ?? []), i.value])));
  const order = (ITEM_DEFS[channel] ?? []).map((d) => d.label);
  const items: ItemAverage[] = [...byItem.entries()]
    .map(([label, values]) => ({ label, average: avg(values) as number, count: values.length }))
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return {
    channel,
    channelLabel: channelLabel(channel),
    average: avg(mine.map((r) => r.rating).filter((v): v is number => v !== null)),
    count: mine.length,
    items,
  };
}

// Canais presentes num conjunto de avaliações, na ordem de exibição.
export function channelsPresent(reviews: NormalizedReview[]): string[] {
  const set = new Set(reviews.map((r) => r.channel));
  return [...set].sort((a, b) => {
    const ia = CHANNEL_ORDER.indexOf(a);
    const ib = CHANNEL_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
}

export function overallAverage(reviews: NormalizedReview[]): number | null {
  return avg(reviews.map((r) => r.rating).filter((v): v is number => v !== null));
}

// Média de cada item avaliado somando todos os canais (itens com o mesmo nome entram juntos).
export function overallItemAverages(reviews: NormalizedReview[]): ItemAverage[] {
  const byItem = new Map<string, number[]>();
  reviews.forEach((r) => r.items.forEach((i) => byItem.set(i.label, [...(byItem.get(i.label) ?? []), i.value])));
  return [...byItem.entries()]
    .map(([label, values]) => ({ label, average: avg(values) as number, count: values.length }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

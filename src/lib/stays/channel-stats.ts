// Regras puras (sem I/O) do "Ticket médio de canais de venda": grupos de suítes,
// canais, contagem de diárias, preço de cada diária cobrada e preço base médio
// cadastrado. Usado pela sincronização (servidor) e pela tela.

import { classifyOrigin, dayNumber, keyFromDayNumber, type CalendarEntryType, type CalendarOrigin } from "@/lib/stays/calendar";

// Cada suíte é o seu próprio grupo: os preços cadastrados na Stays diferem entre suítes
// (mesmo as que se imaginava iguais), então nada é calculado como média de várias suítes.
export type GroupKey = `s${number}`;
export type ChannelKey = "booking" | "airbnb" | "expedia" | "decolar" | "direta";

export const ROOM_GROUPS: { key: GroupKey; label: string; rooms: string[] }[] = Array.from({ length: 11 }, (_, i) => ({
  key: `s${i + 1}` as GroupKey,
  label: `Suíte ${i + 1}`,
  rooms: [String(i + 1)],
}));

export const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: "booking", label: "Booking" },
  { key: "airbnb", label: "Airbnb" },
  { key: "expedia", label: "Expedia" },
  { key: "decolar", label: "Decolar" },
  { key: "direta", label: "Reservas diretas" },
];

export function groupOfRoom(roomNumber: string): GroupKey | null {
  return ROOM_GROUPS.find((g) => g.rooms.includes(roomNumber))?.key ?? null;
}

// Canal da reserva (reaproveita a classificação de origem do calendário).
// Origens que não são um dos 5 canais (bloqueios, "outros") ficam de fora.
export function channelFromOrigin(origin: CalendarOrigin): ChannelKey | null {
  switch (origin) {
    case "booking":
    case "airbnb":
    case "expedia":
    case "decolar":
    case "direta":
      return origin;
    default:
      return null;
  }
}

// "2026-11-02" → "2026-11-01"
export function monthStart(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

// Os `count` meses a partir do mês da data informada (inclusive), como "YYYY-MM-01".
export function monthKeys(todayKey: string, count = 6): string[] {
  const [y, m] = todayKey.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return d.toISOString().slice(0, 10);
  });
}

// Último dia do mês ("2026-11-01" → "2026-11-30").
export function monthEnd(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// Cada diária pertence ao dia em que começa: de check-in até a véspera do check-out.
export function nightDates(checkIn: string, checkOut: string): string[] {
  const start = dayNumber(checkIn);
  const end = dayNumber(checkOut);
  const out: string[] = [];
  for (let n = start; n < end; n++) out.push(keyFromDayNumber(n));
  return out;
}

export interface PricePeriodRaw {
  days: number;
  _f_pricePerDay: number;
}

export interface ReservationForStats {
  checkInDate: string;
  checkOutDate: string;
  _idlisting: string;
  type: CalendarEntryType;
  partner?: { name?: string };
  price?: { hostingDetails?: { _f_nightPrice?: number; pricePeriods?: PricePeriodRaw[] } };
}

// Preço de cada diária da reserva, na ordem. A Stays informa o valor por "períodos"
// (N dias a tanto por dia). Só as diárias entram — taxas como o ISS vêm à parte.
// Se os períodos não fecham com o número de noites (reserva alterada), usa o valor
// das diárias dividido igualmente. Sem nenhuma informação de preço, devolve null.
export function nightlyPrices(res: ReservationForStats): number[] | null {
  const nights = dayNumber(res.checkOutDate) - dayNumber(res.checkInDate);
  if (nights <= 0) return null;
  const host = res.price?.hostingDetails;
  if (!host) return null;
  const periods = host.pricePeriods ?? [];
  const expanded: number[] = [];
  for (const p of periods) for (let i = 0; i < p.days; i++) expanded.push(p._f_pricePerDay);
  if (expanded.length === nights) return expanded;
  if (typeof host._f_nightPrice === "number") return Array.from({ length: nights }, () => host._f_nightPrice! / nights);
  return null;
}

export interface AggCell {
  nights: number; // diárias reservadas no mês
  charged: number; // valor cobrado nessas diárias
  // Só as diárias que têm preço cadastrado na Stays (a mesma base de dias nos dois lados):
  matchedNights: number;
  matchedCharged: number; // cobrado nessas diárias
  registered: number; // preço base cadastrado dessas mesmas diárias
}

// Preço base cadastrado de cada dia, por suíte: listing -> (data -> preço).
export function basePricesByDate(calendarByListing: Map<string, CalendarDayRaw[]>): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [listing, days] of calendarByListing) {
    const byDate = new Map<string, number>();
    for (const d of days) {
      const price = d.prices?.[0]?._mcval?.BRL;
      if (typeof price === "number") byDate.set(d.date, price);
    }
    out.set(listing, byDate);
  }
  return out;
}

// Diárias reservadas e valor cobrado por (grupo, canal, mês), contando dia a dia —
// uma reserva que atravessa a virada do mês dá a cada mês a sua parte das diárias. Para
// cada diária também soma o preço base cadastrado naquele mesmo dia, de modo que o
// "ticket cadastrado" e o "ticket cobrado" tenham exatamente a mesma base de dias.
// Chave: `${grupo}|${canal}|${mês}`.
export function aggregateReservations(
  reservations: ReservationForStats[],
  listingToGroup: Map<string, GroupKey>,
  months: string[],
  basePrices: Map<string, Map<string, number>> = new Map()
): Map<string, AggCell> {
  const wanted = new Set(months);
  const out = new Map<string, AggCell>();
  for (const r of reservations) {
    const group = listingToGroup.get(r._idlisting);
    const channel = channelFromOrigin(classifyOrigin(r.type, r.partner?.name));
    if (!group || !channel) continue;
    const prices = nightlyPrices(r);
    if (!prices) continue;
    const dates = nightDates(r.checkInDate, r.checkOutDate);
    const listingPrices = basePrices.get(r._idlisting);
    dates.forEach((date, i) => {
      const month = monthStart(date);
      if (!wanted.has(month)) return;
      const key = `${group}|${channel}|${month}`;
      const cell = out.get(key) ?? { nights: 0, charged: 0, matchedNights: 0, matchedCharged: 0, registered: 0 };
      cell.nights += 1;
      cell.charged += prices[i];
      const registered = listingPrices?.get(date);
      if (registered !== undefined) {
        cell.matchedNights += 1;
        cell.matchedCharged += prices[i];
        cell.registered += registered;
      }
      out.set(key, cell);
    });
  }
  return out;
}

export interface CalendarDayRaw {
  date: string;
  prices?: { _mcval?: { BRL?: number } }[];
}

export interface BaseAvg {
  avg: number;
  days: number;
}

// Preço base médio cadastrado por (suíte, mês): a média dos preços de cada dia do mês
// que tem preço. Dias sem preço na Stays (ex.: dias já passados do mês corrente) ficam
// de fora. Chave: `${grupo}|${mês}`.
export function baseAverages(
  calendarByListing: Map<string, CalendarDayRaw[]>,
  listingToGroup: Map<string, GroupKey>,
  months: string[]
): Map<string, BaseAvg> {
  const wanted = new Set(months);
  // grupo|dia -> preços das suítes do grupo nesse dia
  const perDay = new Map<string, number[]>();
  for (const [listing, days] of calendarByListing) {
    const group = listingToGroup.get(listing);
    if (!group) continue;
    for (const d of days) {
      const price = d.prices?.[0]?._mcval?.BRL;
      if (typeof price !== "number") continue;
      if (!wanted.has(monthStart(d.date))) continue;
      const key = `${group}|${d.date}`;
      const list = perDay.get(key) ?? [];
      list.push(price);
      perDay.set(key, list);
    }
  }
  const sums = new Map<string, { sum: number; days: number }>();
  for (const [key, prices] of perDay) {
    const [group, date] = key.split("|");
    const mKey = `${group}|${monthStart(date)}`;
    const dayPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const cell = sums.get(mKey) ?? { sum: 0, days: 0 };
    cell.sum += dayPrice;
    cell.days += 1;
    sums.set(mKey, cell);
  }
  const out = new Map<string, BaseAvg>();
  for (const [k, v] of sums) out.set(k, { avg: v.sum / v.days, days: v.days });
  return out;
}

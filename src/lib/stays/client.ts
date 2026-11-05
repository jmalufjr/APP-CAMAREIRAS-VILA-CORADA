// Cliente da API externa da Stays. Usar SOMENTE em Server Actions/rotinas
// server-side (lê STAYS_CLIENT_ID/STAYS_CLIENT_SECRET, sem prefixo
// NEXT_PUBLIC_ — nunca pode ser importado por um componente "use client").
// Ver README.md seção 6 para como obter as credenciais e
// PRD_regrasdenegocio.md para as regras de negócio que consomem esses dados.

export interface StaysReservationRaw {
  _id: string;
  checkInDate: string; // "YYYY-MM-DD"
  checkOutDate: string; // "YYYY-MM-DD"
  _idlisting: string;
  _idclient: string;
  type: string; // "booked" (reserva de hóspede) | "blocked" (bloqueio de calendário, sem hóspede)
  guests: number;
}

function staysAuthHeader(): string {
  const id = process.env.STAYS_CLIENT_ID;
  const secret = process.env.STAYS_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("STAYS_CLIENT_ID/STAYS_CLIENT_SECRET não configuradas.");
  }
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

function staysBaseUrl(): string {
  const baseUrl = process.env.STAYS_BASE_URL;
  if (!baseUrl) throw new Error("STAYS_BASE_URL não configurada.");
  return baseUrl;
}

// Busca todas as reservas de hóspede (ignora bloqueios de calendário) cujo
// período de estadia toca algum dia entre `fromDate` e `toDate` (inclusive)
// — inclui reservas com check-in antes de `fromDate`, desde que o hóspede
// ainda esteja hospedado nesse período (dateType=included na API da Stays).
export async function getStaysReservationsIncluding(
  fromDate: string,
  toDate: string
): Promise<StaysReservationRaw[]> {
  const url = new URL("/external/v1/booking/reservations", staysBaseUrl());
  url.searchParams.set("from", fromDate);
  url.searchParams.set("to", toDate);
  url.searchParams.set("dateType", "included");

  const res = await fetch(url, {
    headers: { Authorization: staysAuthHeader() },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Stays API respondeu ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as StaysReservationRaw[];
  return data.filter((r) => r.type === "booked");
}

// Busca o nome do hóspede (campo "name", já em "Nome Sobrenome") a partir do
// _idclient de uma reserva — não vem embutido no payload de reserva (ver
// PRD_regrasdenegocio.md seção 3). Retorna null em caso de erro/não
// encontrado, nunca lança — quem chama decide o fallback.
export async function getStaysClientName(clientId: string): Promise<string | null> {
  const url = new URL(`/external/v1/booking/clients/${clientId}`, staysBaseUrl());
  const res = await fetch(url, {
    headers: { Authorization: staysAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { name?: string };
  return data.name ?? null;
}

// ---------- Calendário de reservas (Stays) ----------

export type StaysCalendarType = "booked" | "reserved" | "contract" | "blocked" | "maintenance";

export interface StaysCalendarEntryRaw {
  _id: string;
  id: string; // código curto, ex.: "QK01J"
  checkInDate: string;
  checkOutDate: string;
  _idlisting: string;
  _idclient?: string; // não existe em bloqueios
  type: StaysCalendarType;
  partner?: { name?: string };
  internalNote?: string;
}

// A Stays só devolve bloqueios e manutenção se o tipo for pedido
// explicitamente, e no máximo 100 registros por vez — por isso uma consulta
// paginada por tipo. Reservas canceladas ficam de fora de propósito.
const CALENDAR_TYPES: StaysCalendarType[] = ["booked", "reserved", "contract", "blocked", "maintenance"];

async function fetchCalendarType(
  type: StaysCalendarType,
  fromDate: string,
  toDate: string
): Promise<StaysCalendarEntryRaw[]> {
  const all: StaysCalendarEntryRaw[] = [];
  for (let page = 0; page < 30; page++) {
    const url = new URL("/external/v1/booking/reservations", staysBaseUrl());
    url.searchParams.set("from", fromDate);
    url.searchParams.set("to", toDate);
    url.searchParams.set("dateType", "included");
    url.searchParams.set("type", type);
    url.searchParams.set("limit", "100");
    url.searchParams.set("skip", String(page * 100));
    const res = await fetch(url, { headers: { Authorization: staysAuthHeader() }, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Stays API respondeu ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as StaysCalendarEntryRaw[];
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

export async function getStaysCalendarEntries(fromDate: string, toDate: string): Promise<StaysCalendarEntryRaw[]> {
  const lists = await Promise.all(CALENDAR_TYPES.map((t) => fetchCalendarType(t, fromDate, toDate)));
  return lists.flat();
}

// ---------- Ticket médio de canais de venda ----------

export interface StaysCalendarDay {
  date: string;
  prices?: { minStay?: number; _mcval?: { BRL?: number } }[];
}

// Preço base cadastrado dia a dia de uma suíte (o mesmo da tela "Editar Preços" da
// Stays, sem canal escolhido = preço da venda direta). Só devolve de hoje em diante.
export async function getStaysListingCalendar(
  listingId: string,
  fromDate: string,
  toDate: string
): Promise<StaysCalendarDay[]> {
  const url = new URL(`/external/v1/calendar/listing/${listingId}`, staysBaseUrl());
  url.searchParams.set("from", fromDate);
  url.searchParams.set("to", toDate);
  const res = await fetch(url, { headers: { Authorization: staysAuthHeader() }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Stays API respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as StaysCalendarDay[];
}

export interface StaysStatsReservationRaw {
  _id: string;
  id: string;
  checkInDate: string;
  checkOutDate: string;
  _idlisting: string;
  type: "booked" | "reserved" | "contract";
  partner?: { name?: string };
  price?: { hostingDetails?: { _f_nightPrice?: number; pricePeriods?: { days: number; _f_pricePerDay: number }[] } };
}

const STATS_TYPES: StaysStatsReservationRaw["type"][] = ["booked", "reserved", "contract"];

// Reservas (confirmadas, pré-reservas e contratos — sem canceladas nem bloqueios) com o
// detalhe de preço, paginadas de 100 em 100. Uma consulta por vez, para não estourar o
// limite de chamadas da Stays.
export async function getStaysReservationsForStats(
  fromDate: string,
  toDate: string
): Promise<StaysStatsReservationRaw[]> {
  const all: StaysStatsReservationRaw[] = [];
  for (const type of STATS_TYPES) {
    for (let page = 0; page < 30; page++) {
      const url = new URL("/external/v1/booking/reservations", staysBaseUrl());
      url.searchParams.set("from", fromDate);
      url.searchParams.set("to", toDate);
      url.searchParams.set("dateType", "included");
      url.searchParams.set("type", type);
      url.searchParams.set("limit", "100");
      url.searchParams.set("skip", String(page * 100));
      const res = await fetch(url, { headers: { Authorization: staysAuthHeader() }, cache: "no-store" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Stays API respondeu ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as StaysStatsReservationRaw[];
      all.push(...data);
      if (data.length < 100) break;
    }
  }
  return all;
}

// ---------- Avaliações de hóspedes (GET /external/v1/reviews/guest) ----------
// Descoberto na prática: exige `from`/`to` (a API recusa mais de 1 ano; a Stays recomenda consultar de 6 em 6 meses), devolve `reviewList` +
// `totalReviews`, e pagina por `limit` (até 100) e `page` (a partir de 0).
export type StaysReviewRaw = Record<string, unknown> & {
  _id: string;
  source: string;
  day: string;
  rating?: number;
  client?: { _id?: string; fName?: string };
  apartment?: { _id?: string; avatar?: string };
  reserve?: { _id?: string; id?: string };
};

const REVIEWS_PAGE_SIZE = 100;
let reviewsCache: { at: number; data: StaysReviewRaw[] } | null = null;

async function fetchReviewsWindow(from: string, to: string): Promise<StaysReviewRaw[]> {
  const out: StaysReviewRaw[] = [];
  for (let page = 0; page < 50; page++) {
    const url = new URL("/external/v1/reviews/guest", staysBaseUrl());
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("limit", String(REVIEWS_PAGE_SIZE));
    url.searchParams.set("page", String(page));
    const res = await fetch(url, { headers: { Authorization: staysAuthHeader() }, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Stays API respondeu ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { reviewList?: StaysReviewRaw[]; totalReviews?: number };
    const list = data.reviewList ?? [];
    out.push(...list);
    if (list.length === 0 || out.length >= (data.totalReviews ?? 0)) break;
    await new Promise((r) => setTimeout(r, 250)); // a Stays limita chamadas seguidas (429)
  }
  return out;
}

// Todas as avaliações disponíveis: janelas de 6 meses (182 dias), da mais recente para trás, até quatro
// janelas seguidas vazias (2 anos sem nada). Guardado em memória por 5 minutos (a lista muda devagar e cada consulta custa
// várias chamadas à Stays).
export async function getStaysGuestReviews(todayKey: string, fresh = false): Promise<StaysReviewRaw[]> {
  if (!fresh && reviewsCache && Date.now() - reviewsCache.at < 5 * 60 * 1000) return reviewsCache.data;

  const shift = (key: string, days: number) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const all = new Map<string, StaysReviewRaw>();
  let to = todayKey;
  let emptyInARow = 0;
  for (let i = 0; i < 20 && emptyInARow < 4; i++) {
    const from = shift(to, -181);
    const list = await fetchReviewsWindow(from, to);
    list.forEach((r) => all.set(r._id, r));
    emptyInARow = list.length === 0 ? emptyInARow + 1 : 0;
    to = shift(from, -1);
    await new Promise((r) => setTimeout(r, 250));
  }
  const data = [...all.values()];
  reviewsCache = { at: Date.now(), data };
  return data;
}

// ---------- Indicadores (ADR, RevPAR...) ----------
// Reservas com preço (confirmadas, pré-reservas e contratos) e bloqueios/manutenção de um período
// longo, buscados em janelas de 6 meses (mais seguras para a Stays). `fromKey` = null busca todo o
// histórico: volta janela a janela, até 4 seguidas sem nenhuma reserva nem bloqueio (2 anos).
export async function getStaysIndicatorData(
  fromKey: string | null,
  toKey: string
): Promise<{ reservations: StaysStatsReservationRaw[]; blocks: StaysCalendarEntryRaw[] }> {
  const shift = (key: string, days: number) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const reservations = new Map<string, StaysStatsReservationRaw>();
  const blocks = new Map<string, StaysCalendarEntryRaw>();
  const pause = () => new Promise((r) => setTimeout(r, 250));

  let to = toKey;
  let emptyInARow = 0;
  for (let i = 0; i < 30; i++) {
    const from = shift(to, -181);
    if (fromKey && to < fromKey) break;
    const windowFrom = fromKey && from < fromKey ? fromKey : from;

    const res = await getStaysReservationsForStats(windowFrom, to);
    const blk = [...(await fetchCalendarType("blocked", windowFrom, to)), ...(await fetchCalendarType("maintenance", windowFrom, to))];
    res.forEach((r) => reservations.set(r._id, r));
    blk.forEach((b) => blocks.set(b._id, b));

    emptyInARow = res.length === 0 && blk.length === 0 ? emptyInARow + 1 : 0;
    if (!fromKey && emptyInARow >= 4) break;
    to = shift(windowFrom, -1);
    await pause();
  }
  return { reservations: [...reservations.values()], blocks: [...blocks.values()] };
}

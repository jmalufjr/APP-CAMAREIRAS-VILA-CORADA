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

"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/authz";
import { getStaysCalendarEntries, getStaysClientName } from "@/lib/stays/client";
import {
  classifyOrigin,
  dayNumber,
  type CalendarEntry,
  type CalendarRow,
} from "@/lib/stays/calendar";

// Nomes de hóspedes já buscados na Stays, guardados por alguns minutos para a
// segunda abertura da tela ser rápida (cada nome exige uma consulta própria).
const NAME_TTL_MS = 10 * 60 * 1000;
const nameCache = new Map<string, { name: string | null; at: number }>();

async function resolveNames(clientIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const pending: string[] = [];
  const now = Date.now();
  for (const id of clientIds) {
    const hit = nameCache.get(id);
    if (hit && now - hit.at < NAME_TTL_MS) result.set(id, hit.name);
    else pending.push(id);
  }
  // Consultas em grupos de 8 ao mesmo tempo, para não sobrecarregar a Stays.
  const BATCH = 8;
  for (let i = 0; i < pending.length; i += BATCH) {
    const group = pending.slice(i, i + BATCH);
    const names = await Promise.all(group.map((id) => getStaysClientName(id).catch(() => null)));
    group.forEach((id, idx) => {
      nameCache.set(id, { name: names[idx], at: Date.now() });
      result.set(id, names[idx]);
    });
  }
  return result;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;

export async function getStaysCalendar(
  from: string,
  to: string
): Promise<{ rows: CalendarRow[]; error?: undefined } | { rows?: undefined; error: string }> {
  const denied = await requireRole(["admin", "gerente_operacional"]);
  if (denied) return denied;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { error: "Datas inválidas." };
  const span = dayNumber(to) - dayNumber(from);
  if (span < 0) return { error: "A data final precisa ser igual ou posterior à inicial." };
  if (span > MAX_DAYS) return { error: `Escolha um período de no máximo ${MAX_DAYS} dias.` };

  const supabase = await createClient();
  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id, number, stays_listing_id")
    .order("number");
  if (roomsError) return { error: roomsError.message };

  let raw;
  try {
    // Começa um dia antes: a Stays só considera "incluída" a reserva que tem
    // ao menos uma noite dentro do período, então quem sai exatamente no
    // primeiro dia sumiria (mesmo cuidado das sincronizações).
    const fromMinusOne = new Date((dayNumber(from) - 1) * 86400000).toISOString().slice(0, 10);
    raw = await getStaysCalendarEntries(fromMinusOne, to);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível consultar a Stays." };
  }

  const clientIds = Array.from(new Set(raw.map((r) => r._idclient).filter((v): v is string => !!v)));
  const names = await resolveNames(clientIds);

  const byListing = new Map<string, CalendarEntry[]>();
  for (const r of raw) {
    const entry: CalendarEntry = {
      id: r.id,
      type: r.type,
      origin: classifyOrigin(r.type, r.partner?.name),
      guestName: r._idclient ? names.get(r._idclient) ?? null : null,
      checkIn: r.checkInDate,
      checkOut: r.checkOutDate,
      note: r.type === "blocked" || r.type === "maintenance" ? r.internalNote ?? null : null,
    };
    const list = byListing.get(r._idlisting) ?? [];
    list.push(entry);
    byListing.set(r._idlisting, list);
  }

  const rows: CalendarRow[] = (rooms ?? []).map((room) => ({
    roomId: room.id,
    roomNumber: room.number,
    entries: room.stays_listing_id ? byListing.get(room.stays_listing_id) ?? [] : [],
  }));
  return { rows };
}

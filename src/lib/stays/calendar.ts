// Regras puras (sem I/O) do "Calendário de reservas – Stays": classificação da
// origem de cada reserva, códigos de status, paleta de cores e montagem das
// barras. Usado pela Server Action (servidor) e pela grade (navegador).

export type CalendarEntryType = "booked" | "reserved" | "contract" | "blocked" | "maintenance";

export type CalendarOrigin =
  | "booking"
  | "airbnb"
  | "decolar"
  | "expedia"
  | "direta"
  | "bloqueio"
  | "manutencao"
  | "outros";

export interface OriginStyle {
  label: string; // por extenso (cartão e legenda)
  sigla: string; // marca pequena dentro da barra
  bg: string;
  fg: string;
}

// Cores escolhidas para se distinguirem bem entre si, inclusive no celular,
// respeitando a orientação do proprietário (azul escuro, verde escuro, verde
// claro, azul claro, vermelho escuro, laranja, amarelo escuro, vermelho claro).
export const ORIGIN_STYLES: Record<CalendarOrigin, OriginStyle> = {
  booking: { label: "Booking", sigla: "B", bg: "#1E3A8A", fg: "#FFFFFF" },
  airbnb: { label: "Airbnb", sigla: "A", bg: "#15803D", fg: "#FFFFFF" },
  decolar: { label: "Decolar", sigla: "D", bg: "#86EFAC", fg: "#052E16" },
  expedia: { label: "Expedia", sigla: "E", bg: "#38BDF8", fg: "#082F49" },
  direta: { label: "Reserva direta", sigla: "R", bg: "#EAB308", fg: "#1C1917" },
  bloqueio: { label: "Bloqueio genérico", sigla: "Bl", bg: "#991B1B", fg: "#FFFFFF" },
  manutencao: { label: "Bloqueio de manutenção", sigla: "M", bg: "#C2410C", fg: "#FFFFFF" },
  outros: { label: "Outros", sigla: "?", bg: "#FCA5A5", fg: "#450A0A" },
};

export const ORIGIN_ORDER: CalendarOrigin[] = [
  "booking",
  "airbnb",
  "decolar",
  "expedia",
  "direta",
  "bloqueio",
  "manutencao",
  "outros",
];

// Situação da reserva: por extenso no cartão, em código dentro da barra
// (confirmada, bloqueio e manutenção não mostram código nenhum).
export const STATUS_INFO: Record<CalendarEntryType, { label: string; code: string }> = {
  booked: { label: "Confirmada", code: "" },
  reserved: { label: "Pré-reserva", code: "Pre" },
  contract: { label: "Contrato", code: "Con" },
  blocked: { label: "Bloqueio", code: "" },
  maintenance: { label: "Bloqueio de manutenção", code: "" },
};

// Origem a partir do tipo e do "parceiro" informado pela Stays. Sem parceiro,
// ou parceiro "Website", é reserva direta (inserida à mão ou vinda do site).
export function classifyOrigin(type: CalendarEntryType, partnerName: string | null | undefined): CalendarOrigin {
  if (type === "blocked") return "bloqueio";
  if (type === "maintenance") return "manutencao";
  const p = (partnerName ?? "").trim().toLowerCase();
  if (!p) return "direta";
  if (p.includes("booking")) return "booking";
  if (p.includes("airbnb")) return "airbnb";
  if (p.includes("decolar")) return "decolar";
  if (p.includes("expedia")) return "expedia";
  if (p.includes("website") || p === "site") return "direta";
  return "outros";
}

export interface CalendarEntry {
  id: string; // código curto da Stays (ex.: "QK01J")
  type: CalendarEntryType;
  origin: CalendarOrigin;
  guestName: string | null; // null em bloqueios
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  note: string | null; // observação interna (só bloqueios)
}

export interface CalendarRow {
  roomId: string;
  roomNumber: string;
  entries: CalendarEntry[];
}

// Texto exibido dentro da barra: "Nome (Pre)", "Nome" (confirmada),
// "Bloqueado" ou "Manutenção".
export function barLabel(e: CalendarEntry): string {
  const code = STATUS_INFO[e.type].code;
  const isBlock = e.type === "blocked" || e.type === "maintenance";
  const base = e.guestName ?? (e.type === "maintenance" ? "Manutenção" : isBlock ? "Bloqueado" : "Sem nome");
  return code ? `${base} (${code})` : base;
}

// ---------- datas "YYYY-MM-DD" (sempre em UTC, sem fuso) ----------

export function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function keyFromDayNumber(n: number): string {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return dayNumber(checkOut) - dayNumber(checkIn);
}

// ---------- barras e faixas ----------

export interface PlacedBar {
  entry: CalendarEntry;
  lane: number;
  // posição em "dias" a partir do primeiro dia da grade (pode ser fracionária)
  startDay: number;
  endDay: number;
  clippedLeft: boolean; // começa antes do período mostrado
  clippedRight: boolean; // termina depois do período mostrado
}

// Entrada à tarde (~55% do dia) e saída de manhã (~45%): duas reservas
// seguidas na mesma suíte se encaixam sem se sobrepor.
const CHECK_IN_OFFSET = 0.55;
const CHECK_OUT_OFFSET = 0.45;

// Posiciona as barras de uma suíte. Barras que se sobrepõem (ex.: bloqueio por
// cima de uma reserva) vão para "faixas" separadas, uma embaixo da outra.
export function placeBars(entries: CalendarEntry[], fromKey: string, toKey: string): { bars: PlacedBar[]; lanes: number } {
  const first = dayNumber(fromKey);
  const last = dayNumber(toKey);
  const placed: PlacedBar[] = [];
  const sorted = [...entries].sort((a, b) => dayNumber(a.checkIn) - dayNumber(b.checkIn));
  const laneEnds: number[] = [];

  for (const entry of sorted) {
    const rawStart = dayNumber(entry.checkIn) - first + CHECK_IN_OFFSET;
    const rawEnd = dayNumber(entry.checkOut) - first + CHECK_OUT_OFFSET;
    if (rawEnd <= 0 || rawStart >= last - first + 1) continue; // fora do período
    const startDay = Math.max(rawStart, 0);
    const endDay = Math.min(rawEnd, last - first + 1);
    let lane = laneEnds.findIndex((end) => end <= startDay);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = endDay;
    placed.push({ entry, lane, startDay, endDay, clippedLeft: rawStart < 0, clippedRight: rawEnd > last - first + 1 });
  }
  return { bars: placed, lanes: Math.max(laneEnds.length, 1) };
}

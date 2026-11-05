// Regras puras (sem I/O) dos "Indicadores" (ADR, RevPAR, NetRevPAR, ocupação) — ver PRD_indicadores.md.
// Tudo é contado por diária (room night): cada diária pertence ao dia em que começa (check-in
// inclusivo, check-out exclusivo) e vai para o mês desse dia.

import { classifyOrigin } from "@/lib/stays/calendar";
import {
  channelFromOrigin,
  monthEnd,
  monthStart,
  nightDates,
  nightlyPrices,
  type ReservationForStats,
} from "@/lib/stays/channel-stats";

export type IndChannel = "booking" | "airbnb" | "expedia" | "decolar" | "direta" | "outros";

export const IND_CHANNELS: { key: IndChannel; label: string }[] = [
  { key: "booking", label: "Booking" },
  { key: "airbnb", label: "Airbnb" },
  { key: "expedia", label: "Expedia" },
  { key: "decolar", label: "Decolar/Despegar" },
  { key: "direta", label: "Reservas diretas" },
  { key: "outros", label: "Outros" },
];

export interface ChannelMonthBase {
  paid: number; // diárias vendidas (com cobrança)
  free: number; // diárias gratuitas (valor 0 ou sem preço)
  revenue: number; // receita bruta de hospedagem dessas diárias (sem impostos/taxas)
}

export interface MonthBase {
  month: string; // "YYYY-MM-01"
  blocked: number; // noites de bloqueio
  maintenance: number; // noites de manutenção
  channels: Record<IndChannel, ChannelMonthBase>;
}

export interface BlockEntry {
  checkInDate: string;
  checkOutDate: string;
  _idlisting: string;
  type: "blocked" | "maintenance";
}

const emptyChannels = (): Record<IndChannel, ChannelMonthBase> => ({
  booking: { paid: 0, free: 0, revenue: 0 },
  airbnb: { paid: 0, free: 0, revenue: 0 },
  expedia: { paid: 0, free: 0, revenue: 0 },
  decolar: { paid: 0, free: 0, revenue: 0 },
  direta: { paid: 0, free: 0, revenue: 0 },
  outros: { paid: 0, free: 0, revenue: 0 },
});

// Meses de `fromMonth` a `toMonth` (inclusive), como "YYYY-MM-01".
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  const out: string[] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m++) {
    if (m > 12) {
      m = 1;
      y++;
    }
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    if (y === ty && m === tm) break;
  }
  return out;
}

export function daysInMonth(month: string): number {
  return Number(monthEnd(month).slice(8, 10));
}

// Reservas (já sem as canceladas) e bloqueios → base de cada mês pedido. Só entram suítes de
// `listingIds` (as suítes do app). Diárias de um mês que não está em `months` são ignoradas.
export function computeMonthBases(
  reservations: ReservationForStats[],
  blocks: BlockEntry[],
  listingIds: Set<string>,
  months: string[]
): Map<string, MonthBase> {
  const wanted = new Set(months);
  const out = new Map<string, MonthBase>();
  const get = (month: string) => {
    let b = out.get(month);
    if (!b) {
      b = { month, blocked: 0, maintenance: 0, channels: emptyChannels() };
      out.set(month, b);
    }
    return b;
  };
  months.forEach((m) => get(m));

  for (const r of reservations) {
    if (!listingIds.has(r._idlisting)) continue;
    const channel: IndChannel = channelFromOrigin(classifyOrigin(r.type, r.partner?.name)) ?? "outros";
    const prices = nightlyPrices(r);
    nightDates(r.checkInDate, r.checkOutDate).forEach((date, i) => {
      const month = monthStart(date);
      if (!wanted.has(month)) return;
      const cell = get(month).channels[channel];
      const price = prices ? prices[i] : 0;
      if (price > 0) {
        cell.paid += 1;
        cell.revenue += price;
      } else {
        cell.free += 1;
      }
    });
  }

  // Bloqueios/manutenção: uma noite por (suíte, dia), mesmo que haja bloqueios sobrepostos.
  const seen = new Set<string>();
  for (const b of blocks) {
    if (!listingIds.has(b._idlisting)) continue;
    for (const date of nightDates(b.checkInDate, b.checkOutDate)) {
      const month = monthStart(date);
      if (!wanted.has(month)) continue;
      const key = `${b._idlisting}|${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const base = get(month);
      if (b.type === "maintenance") base.maintenance += 1;
      else base.blocked += 1;
    }
  }
  return out;
}

export interface MonthIndicators {
  month: string;
  days: number;
  supply: number; // noites disponíveis (STR): suítes × dias do mês
  paid: number;
  free: number;
  blocked: number;
  maintenance: number;
  revenue: number; // receita bruta de hospedagem
  commission: number;
  netRevenue: number;
  adr: number | null;
  revpar: number | null;
  netRevpar: number | null;
  occCommercial: number | null; // 0 a 1
  occPhysical: number | null; // 0 a 1
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

// `commissionPct`: percentual por canal (ex.: 15 = 15%). Regras (PRD_indicadores.md, seção 2.1):
// oferta = suítes × dias (padrão STR, sem descontar bloqueio/manutenção); ADR = receita ÷ diárias
// pagas; RevPAR = receita ÷ oferta; NetRevPAR = (receita − comissões) ÷ oferta; Ocupação comercial
// = pagas ÷ oferta; Ocupação física (conceito do PRD, fora da STR) = (pagas + gratuitas +
// bloqueio) ÷ (oferta − manutenção).
export function computeIndicators(base: MonthBase, rooms: number, commissionPct: Partial<Record<IndChannel, number>>): MonthIndicators {
  const days = daysInMonth(base.month);
  const supply = rooms * days;
  let paid = 0;
  let free = 0;
  let revenue = 0;
  let commission = 0;
  for (const { key } of IND_CHANNELS) {
    const c = base.channels[key];
    paid += c.paid;
    free += c.free;
    revenue += c.revenue;
    commission += (c.revenue * (commissionPct[key] ?? 0)) / 100;
  }
  const netRevenue = revenue - commission;
  return {
    month: base.month,
    days,
    supply,
    paid,
    free,
    blocked: base.blocked,
    maintenance: base.maintenance,
    revenue,
    commission,
    netRevenue,
    adr: div(revenue, paid),
    revpar: div(revenue, supply),
    netRevpar: div(netRevenue, supply),
    occCommercial: div(paid, supply),
    occPhysical: div(paid + free + base.blocked, supply - base.maintenance),
  };
}

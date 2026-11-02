"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ORIGIN_STYLES,
  ORIGIN_ORDER,
  STATUS_INFO,
  barLabel,
  dayNumber,
  keyFromDayNumber,
  nightsBetween,
  placeBars,
  type CalendarRow,
  type PlacedBar,
} from "@/lib/stays/calendar";

const DAY_W = 52; // largura de cada dia, em px
const LEFT_W = 84; // coluna fixa com o nome das suítes
const LANE_H = 30;
const ROW_PAD = 10;

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

function formatBr(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

interface OpenCard {
  bar: PlacedBar;
  roomNumber: string;
  x: number;
  y: number;
}

export function StaysCalendarGrid({
  rows,
  from,
  to,
  today,
}: {
  rows: CalendarRow[];
  from: string;
  to: string;
  today: string;
}) {
  const first = dayNumber(from);
  const totalDays = dayNumber(to) - first + 1;
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerType = useRef<string>("mouse");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [card, setCard] = useState<OpenCard | null>(null);

  const days = useMemo(
    () =>
      Array.from({ length: totalDays }, (_, i) => {
        const key = keyFromDayNumber(first + i);
        const d = new Date((first + i) * 86400000);
        return { key, weekday: d.getUTCDay(), day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
      }),
    [first, totalDays]
  );

  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    days.forEach((d) => {
      const label = `${MONTHS[d.month]} DE ${d.year}`;
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.span += 1;
      else groups.push({ label, span: 1 });
    });
    return groups;
  }, [days]);

  const placed = useMemo(
    () => rows.map((r) => ({ row: r, ...placeBars(r.entries, from, to) })),
    [rows, from, to]
  );

  const todayIndex = dayNumber(today) - first;

  // Ao abrir, rola a grade até o dia de hoje (se ele estiver no período).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && todayIndex >= 0 && todayIndex < totalDays) {
      el.scrollLeft = Math.max(todayIndex * DAY_W - 40, 0);
    }
  }, [todayIndex, totalDays]);

  // Toque fora da barra/cartão fecha o cartão (celular).
  useEffect(() => {
    function onDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-cal-bar]") && !target?.closest("[data-cal-card]")) setCard(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function clearTimer() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function openCard(el: HTMLElement, bar: PlacedBar, roomNumber: string) {
    clearTimer();
    const rect = el.getBoundingClientRect();
    const width = 288;
    const x = Math.min(Math.max(rect.left, 8), Math.max(window.innerWidth - width - 8, 8));
    const below = rect.bottom + 8;
    const y = below + 190 > window.innerHeight ? Math.max(rect.top - 190, 8) : below;
    setCard({ bar, roomNumber, x, y });
  }

  function scheduleClose(ms: number) {
    clearTimer();
    closeTimer.current = setTimeout(() => setCard(null), ms);
  }

  const bodyHeights = placed.map((p) => p.lanes * LANE_H + ROW_PAD);
  const trackWidth = totalDays * DAY_W;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {ORIGIN_ORDER.map((o) => (
          <span key={o} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-full" style={{ background: ORIGIN_STYLES[o].bg }} />
            {ORIGIN_STYLES[o].label}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Códigos ao lado do nome: (Pre) pré-reserva · (Con) contrato. Reserva confirmada, bloqueio e manutenção não
        levam código.
      </p>

      <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="relative" style={{ width: LEFT_W + trackWidth }}>
          {/* Fundo por dia: fim de semana cinza e hoje destacado */}
          <div className="pointer-events-none absolute bottom-0 top-0 flex" style={{ left: LEFT_W, width: trackWidth }}>
            {days.map((d, i) => (
              <div
                key={d.key}
                className={
                  i === todayIndex
                    ? "border-x-2 border-red-500 bg-red-500/15"
                    : d.weekday === 0 || d.weekday === 6
                    ? "bg-muted/70"
                    : ""
                }
                style={{ width: DAY_W, flex: "none" }}
              />
            ))}
          </div>

          {/* Cabeçalho: meses e dias */}
          <div className="relative flex">
            <div className="sticky left-0 z-20 shrink-0 border-b border-r border-border bg-card" style={{ width: LEFT_W }} />
            <div className="flex">
              {monthGroups.map((g, i) => (
                <div
                  key={`${g.label}-${i}`}
                  className="truncate border-b border-border bg-muted px-2 py-1.5 text-center text-xs font-semibold tracking-wide"
                  style={{ width: g.span * DAY_W }}
                >
                  {g.span >= 4 ? g.label : ""}
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex">
            <div className="sticky left-0 z-20 shrink-0 border-b border-r border-border bg-card" style={{ width: LEFT_W }} />
            <div className="flex">
              {days.map((d, i) => (
                <div
                  key={d.key}
                  className={`border-b border-border py-1 text-center text-[11px] leading-tight ${
                    i === todayIndex ? "font-bold text-red-600" : d.weekday === 0 || d.weekday === 6 ? "text-orange-600" : "text-muted-foreground"
                  }`}
                  style={{ width: DAY_W, flex: "none" }}
                >
                  <div>{WEEKDAYS[d.weekday]}</div>
                  <div className="text-sm font-medium">{String(d.day).padStart(2, "0")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Linhas das suítes */}
          {placed.map((p, idx) => (
            <div key={p.row.roomId} className="relative flex" style={{ height: bodyHeights[idx] }}>
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center border-b border-r border-border bg-card px-3 text-sm font-medium"
                style={{ width: LEFT_W }}
              >
                Suíte {p.row.roomNumber}
              </div>
              <div className="relative border-b border-border" style={{ width: trackWidth }}>
                {p.bars.map((b) => {
                  const st = ORIGIN_STYLES[b.entry.origin];
                  return (
                    <button
                      key={`${b.entry.id}-${b.entry.checkIn}-${b.lane}`}
                      type="button"
                      data-cal-bar
                      className={`absolute z-10 flex items-center gap-1.5 overflow-hidden whitespace-nowrap px-1.5 text-xs font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        b.clippedLeft ? "rounded-l-none" : "rounded-l-full"
                      } ${b.clippedRight ? "rounded-r-none" : "rounded-r-full"}`}
                      style={{
                        left: b.startDay * DAY_W,
                        width: (b.endDay - b.startDay) * DAY_W,
                        top: ROW_PAD / 2 + b.lane * LANE_H,
                        height: LANE_H - 4,
                        background: st.bg,
                        color: st.fg,
                      }}
                      onPointerDown={(e) => {
                        pointerType.current = e.pointerType;
                      }}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") openCard(e.currentTarget, b, p.row.roomNumber);
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType === "mouse") scheduleClose(80);
                      }}
                      onFocus={(e) => openCard(e.currentTarget, b, p.row.roomNumber)}
                      onBlur={() => scheduleClose(80)}
                      onClick={(e) => {
                        if (pointerType.current === "mouse") return;
                        if (card && card.bar === b) {
                          setCard(null);
                          return;
                        }
                        openCard(e.currentTarget, b, p.row.roomNumber);
                        scheduleClose(6000);
                      }}
                    >
                      <span
                        className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-0.5 text-[9px] font-bold"
                        style={{ background: st.fg, color: st.bg }}
                      >
                        {st.sigla}
                      </span>
                      <span className="truncate">{barLabel(b.entry)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma suíte cadastrada.</p>
          )}
        </div>
      </div>

      {card && (
        <div
          data-cal-card
          className="pointer-events-none fixed z-50 w-72 space-y-1.5 rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
          style={{ left: card.x, top: card.y }}
        >
          <p className="font-heading text-base leading-snug">
            {card.bar.entry.guestName ?? (card.bar.entry.type === "maintenance" ? "Manutenção" : "Bloqueio")}
          </p>
          <p>
            <span className="text-muted-foreground">Suíte:</span> {card.roomNumber}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Origem:</span>
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: ORIGIN_STYLES[card.bar.entry.origin].bg }}
            />
            {ORIGIN_STYLES[card.bar.entry.origin].label}
          </p>
          <p>
            <span className="text-muted-foreground">Situação:</span> {STATUS_INFO[card.bar.entry.type].label}
          </p>
          <p>
            <span className="text-muted-foreground">Período:</span> {formatBr(card.bar.entry.checkIn)} a{" "}
            {formatBr(card.bar.entry.checkOut)} ({nightsBetween(card.bar.entry.checkIn, card.bar.entry.checkOut)}{" "}
            {nightsBetween(card.bar.entry.checkIn, card.bar.entry.checkOut) === 1 ? "noite" : "noites"})
          </p>
          {card.bar.entry.note && (
            <p>
              <span className="text-muted-foreground">Observação:</span> {card.bar.entry.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

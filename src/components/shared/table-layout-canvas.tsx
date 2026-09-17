"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { BreakfastTable } from "@/lib/types";

export interface TableRoomAssignment {
  roomNumber: string;
  guestCount: number;
}

interface Props {
  tables: BreakfastTable[];
  guestCounts?: Record<string, number>;
  // Suíte(s) alocada(s) em cada mesa (Mesa 7 pode ter mais de uma — ver
  // PRD_regrasdenegocio.md seção 4). Quando ausente para uma mesa, cai de
  // volta pro total simples de `guestCounts` (compatibilidade com dias/
  // mesas que ainda não têm suíte associada).
  tableRooms?: Record<string, TableRoomAssignment[]>;
  editable?: boolean;
  onPositionsChange?: (positions: { id: string; pos_x: number; pos_y: number }[]) => void;
}

export function TableLayoutCanvas({ tables, guestCounts, tableRooms, editable, onPositionsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(tables.map((t) => [t.id, { x: t.pos_x, y: t.pos_y }]))
  );
  const dragging = useRef<string | null>(null);

  function handlePointerDown(id: string) {
    if (!editable) return;
    dragging.current = id;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!editable || !dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - 35);
    const y = Math.max(0, e.clientY - rect.top - 35);
    setPositions((prev) => ({ ...prev, [dragging.current!]: { x, y } }));
  }

  function handlePointerUp() {
    if (!editable || !dragging.current) return;
    dragging.current = null;
    onPositionsChange?.(
      Object.entries(positions).map(([id, p]) => ({ id, pos_x: p.x, pos_y: p.y }))
    );
  }

  const maxHeight = Math.max(600, ...tables.map((t) => (positions[t.id]?.y ?? t.pos_y) + t.height + 40));

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative w-full rounded-xl border border-border bg-muted/40 overflow-auto"
      style={{ height: 620 }}
    >
      <div className="relative" style={{ height: maxHeight, minWidth: 420 }}>
        {tables.map((t) => {
          const pos = positions[t.id] ?? { x: t.pos_x, y: t.pos_y };
          const count = guestCounts?.[t.id] ?? 0;
          const rooms = tableRooms?.[t.id] ?? [];
          const occupied = count > 0;
          return (
            <div
              key={t.id}
              onPointerDown={() => handlePointerDown(t.id)}
              className={cn(
                "absolute flex flex-col items-center justify-center gap-0.5 shadow-sm select-none overflow-hidden",
                // Mesas ocupadas recebem a cor de destaque do tema (pra
                // saltar aos olhos), vagas ficam numa tonalidade discreta —
                // a combinação exata muda por tema, ver CLAUDE.md Parte 20:
                // - Claro: ocupada = azul sólido + fonte clara; vaga = azul
                //   bem clarinho + fonte escura.
                // - Escuro azul: ocupada = azul mais escuro que o fundo da
                //   tela + fonte clara; vaga = azul um pouco mais claro que
                //   o fundo + fonte clara (nunca fica clara o bastante pra
                //   precisar de fonte escura).
                // - Escuro bordô: ocupada = bordô bem mais escuro que o
                //   fundo + fonte clara; vaga = bordô bem mais claro que o
                //   fundo (quase rosado) + fonte escura.
                occupied
                  ? "bg-secondary text-secondary-foreground theme-bordo:bg-[#2A0D10] theme-bordo:text-[#F9F9F7] theme-blue:bg-[#262D45] theme-blue:text-[#F9F9F7]"
                  : "bg-secondary/30 text-secondary theme-bordo:bg-[#E6C6C8] theme-bordo:text-[#5A2025] theme-blue:bg-[#4C577A] theme-blue:text-[#F9F9F7]",
                t.shape === "round" ? "rounded-full" : t.shape === "square" ? "rounded-md" : "rounded-2xl",
                editable && "cursor-move active:cursor-grabbing"
              )}
              style={{ left: pos.x, top: pos.y, width: t.width, height: t.height }}
            >
              <span className="text-xs font-medium">{t.label}</span>
              {rooms.length > 0
                ? rooms.map((r) => (
                    <div key={r.roomNumber} className="flex flex-col items-center leading-tight">
                      <span className="text-[11px] font-semibold">Suíte {r.roomNumber}</span>
                      <span className="text-[10px] font-medium">
                        {r.guestCount} hóspede{r.guestCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))
                : guestCounts && (
                    <span className="text-[11px] font-semibold">
                      {count} hóspede{count === 1 ? "" : "s"}
                    </span>
                  )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

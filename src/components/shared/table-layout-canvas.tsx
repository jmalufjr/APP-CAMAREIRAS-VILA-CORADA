"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { BreakfastTable } from "@/lib/types";

interface Props {
  tables: BreakfastTable[];
  guestCounts?: Record<string, number>;
  editable?: boolean;
  onPositionsChange?: (positions: { id: string; pos_x: number; pos_y: number }[]) => void;
}

export function TableLayoutCanvas({ tables, guestCounts, editable, onPositionsChange }: Props) {
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
          return (
            <div
              key={t.id}
              onPointerDown={() => handlePointerDown(t.id)}
              className={cn(
                "absolute flex flex-col items-center justify-center text-primary-foreground bg-secondary shadow-sm select-none",
                t.shape === "round" ? "rounded-full" : "rounded-2xl",
                editable && "cursor-move active:cursor-grabbing"
              )}
              style={{ left: pos.x, top: pos.y, width: t.width, height: t.height }}
            >
              <span className="text-xs font-medium">{t.label}</span>
              {guestCounts && (
                <span className="text-[11px] opacity-90">{count} hóspede{count === 1 ? "" : "s"}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

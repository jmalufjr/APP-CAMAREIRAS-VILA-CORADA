"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuantityStepper({
  value,
  onChange,
  disabled,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  // Sem limite superior quando omitido (comportamento original).
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={14} />
      </Button>
      <span className="w-6 text-center text-sm tabular-nums">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}

"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuantityStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <Minus size={14} />
      </Button>
      <span className="w-6 text-center text-sm tabular-nums">{value}</span>
      <Button type="button" variant="outline" size="icon-sm" disabled={disabled} onClick={() => onChange(value + 1)}>
        <Plus size={14} />
      </Button>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface LinkRow {
  id: string;
  pct: number;
}

function sumPct(links: LinkRow[]): number {
  return links.reduce((s, l) => s + l.pct, 0);
}

// Editor de vínculos item de custo → centro de custo, com percentual —
// os % precisam somar exatamente 100%.
export function PctLinksEditor({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: LinkRow[];
  onChange: (next: LinkRow[]) => void;
}) {
  function add() {
    const used = new Set(value.map((v) => v.id));
    const next = options.find((o) => !used.has(o.id)) ?? options[0];
    if (!next) return;
    onChange([...value, { id: next.id, pct: value.length === 0 ? 100 : 0 }]);
  }
  function update(index: number, patch: Partial<LinkRow>) {
    onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const sum = sumPct(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          Centros (% precisam somar 100% — soma atual: {sum}%)
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={add} disabled={value.length >= options.length}>
          <Plus size={12} /> Centro
        </Button>
      </div>
      {value.map((link, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select value={link.id} onValueChange={(v) => v && update(index, { id: v })}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione">
                {(v: string) => options.find((o) => o.id === v)?.label ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            max={100}
            className="w-20"
            value={link.pct}
            onChange={(e) => update(index, { pct: Number(e.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
            <Trash2 size={12} />
          </Button>
        </div>
      ))}
      {value.length === 0 && <p className="text-xs text-muted-foreground">Nenhum centro vinculado ainda.</p>}
    </div>
  );
}


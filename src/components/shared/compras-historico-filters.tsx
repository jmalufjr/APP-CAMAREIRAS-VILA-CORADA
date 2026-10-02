"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExpenseCategory } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ComprasHistoricoFilters({
  from,
  to,
  categoryId,
  categories,
  basePath = "/compras/historico",
}: {
  from: string;
  to: string;
  categoryId: string;
  categories: ExpenseCategory[];
  basePath?: string;
}) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [cat, setCat] = useState(categoryId);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="from">De</Label>
        <Input id="from" type="date" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to">Até</Label>
        <Input id="to" type="date" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <div className="space-y-1.5 min-w-48">
        <Label>Categoria</Label>
        <Select value={cat} onValueChange={(v) => setCat(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas">{(v: string) => categories.find((c) => c.id === v)?.name ?? "Todas"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={() =>
          router.push(`${basePath}?from=${f}&to=${t}${cat && cat !== "todas" ? `&category=${cat}` : ""}`)
        }
      >
        Filtrar
      </Button>
    </div>
  );
}

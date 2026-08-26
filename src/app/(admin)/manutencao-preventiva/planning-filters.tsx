"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function PlanningFilters({ from, to }: { from: string; to: string }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="planning-from">De</Label>
        <Input id="planning-from" type="date" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="planning-to">Até</Label>
        <Input id="planning-to" type="date" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <Button onClick={() => router.push(`/manutencao-preventiva?from=${f}&to=${t}`)}>Filtrar</Button>
    </div>
  );
}

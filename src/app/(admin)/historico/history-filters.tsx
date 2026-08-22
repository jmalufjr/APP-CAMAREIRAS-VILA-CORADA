"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function HistoryFilters({ from, to }: { from: string; to: string }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
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
      <Button onClick={() => router.push(`/historico?from=${f}&to=${t}`)}>Filtrar</Button>
    </div>
  );
}

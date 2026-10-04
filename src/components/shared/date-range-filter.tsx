"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Filtro de período genérico (de/até), reaproveitável em qualquer tela
// que já siga o padrão de query params ?from=&to= — mesmo visual do
// filtro já usado em "Histórico", só parametrizado pela rota de destino.
export function DateRangeFilter({ basePath, from, to }: { basePath: string; from: string; to: string }) {
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
      <Button onClick={() => router.push(`${basePath}?from=${f}&to=${t}`)}>Filtrar</Button>
    </div>
  );
}

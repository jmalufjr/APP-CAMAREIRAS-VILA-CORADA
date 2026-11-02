"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateChannelCorrection } from "@/lib/actions/channel-stats";
import { CHANNELS, type ChannelKey } from "@/lib/stays/channel-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Percentual de correção de preço de cada canal — o mesmo número que fica na Stays em
// Dashboard de Channel Managers > (canal) > Configurações > Financeiro. A API da Stays
// não o entrega, então é digitado aqui; basta atualizar quando mudar na Stays.
export function ChannelSettingsCard({ initial }: { initial: Record<ChannelKey, number | null> }) {
  const [values, setValues] = useState<Record<ChannelKey, string>>(
    Object.fromEntries(CHANNELS.map((c) => [c.key, initial[c.key] === null ? "" : String(initial[c.key])])) as Record<
      ChannelKey,
      string
    >
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      for (const c of CHANNELS) {
        const raw = values[c.key].trim().replace(",", ".");
        const pct = raw === "" ? null : Number(raw);
        if (pct !== null && Number.isNaN(pct)) {
          toast.error(`${c.label}: percentual inválido.`);
          return;
        }
        const r = await updateChannelCorrection(c.key, pct);
        if (r && "error" in r && r.error) {
          toast.error(`${c.label}: ${r.error}`);
          return;
        }
      }
      toast.success("Percentuais salvos.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h3 className="font-heading text-lg">Correção de preço de cada canal (%)</h3>
          <p className="text-sm text-muted-foreground">
            Copie da Stays: Dashboard de Channel Managers &gt; (canal) &gt; Configurações &gt; Financeiro &gt;
            Correção de preço. O preço do canal é o preço base da Stays aumentado desse percentual (Website = 0).
            Canal sem percentual mostra “—” no preço.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CHANNELS.map((c) => (
            <label key={c.key} className="space-y-1 text-sm">
              <span className="block text-muted-foreground">{c.label}</span>
              <div className="flex items-center gap-1">
                <input
                  inputMode="decimal"
                  value={values[c.key]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [c.key]: e.target.value }))}
                  placeholder="—"
                  className="h-9 w-full rounded-md border border-input bg-background px-2"
                />
                <span>%</span>
              </div>
            </label>
          ))}
        </div>
        <Button onClick={save} disabled={isPending}>
          Salvar percentuais
        </Button>
      </CardContent>
    </Card>
  );
}

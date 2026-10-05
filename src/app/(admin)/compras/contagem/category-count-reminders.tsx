"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SubcenterGroupCountStatus } from "@/lib/actions/inventory-counts";
import { updateSubcenterGroupCountFrequency } from "@/lib/actions/cost-plan";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StartCountButton } from "./start-count-button";
import { formatDatePt } from "@/lib/date";
import { AlertTriangle } from "lucide-react";

// Agrupado por nome de subcentro (ex.: "Alimentos" junta Café da manhã e
// Bar da piscina numa contagem só) — ver startCountSession.
export function CategoryCountReminders({ statuses }: { statuses: SubcenterGroupCountStatus[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [editing, setEditing] = useState<Record<string, string>>(
    Object.fromEntries(statuses.map((s) => [s.group_name, s.count_frequency_days === null ? "" : String(s.count_frequency_days)]))
  );

  function handleBlur(groupName: string, original: number | null) {
    const raw = editing[groupName];
    const value = raw === "" ? null : Number(raw);
    if (value === original) return;
    startTransition(async () => {
      const result = await updateSubcenterGroupCountFrequency(groupName, value);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {statuses.map((s) => (
        <div key={s.group_name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium flex items-center gap-2">
              {s.group_name}
              {s.is_due && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle size={11} /> Está na hora de contar
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.last_closed_at ? `Última contagem: ${formatDatePt(s.last_closed_at)}` : "Nunca contada"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              className="w-20"
              placeholder="—"
              disabled={isPending}
              value={editing[s.group_name] ?? ""}
              onChange={(e) => setEditing((prev) => ({ ...prev, [s.group_name]: e.target.value }))}
              onBlur={() => handleBlur(s.group_name, s.count_frequency_days)}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">dias (opcional)</span>
          </div>
          <StartCountButton groupName={s.group_name} label="Iniciar contagem" />
        </div>
      ))}
    </div>
  );
}

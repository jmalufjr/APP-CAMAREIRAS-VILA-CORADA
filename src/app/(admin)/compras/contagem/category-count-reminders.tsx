"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CategoryCountStatus } from "@/lib/actions/inventory-counts";
import { updateExpenseCategoryCountFrequency } from "@/lib/actions/expense-categories";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StartCountButton } from "./start-count-button";
import { formatDatePt } from "@/lib/date";
import { AlertTriangle } from "lucide-react";

export function CategoryCountReminders({ statuses }: { statuses: CategoryCountStatus[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [editing, setEditing] = useState<Record<string, string>>(
    Object.fromEntries(statuses.map((s) => [s.category_id, s.count_frequency_days === null ? "" : String(s.count_frequency_days)]))
  );

  function handleBlur(categoryId: string, original: number | null) {
    const raw = editing[categoryId];
    const value = raw === "" ? null : Number(raw);
    if (value === original) return;
    startTransition(async () => {
      const result = await updateExpenseCategoryCountFrequency(categoryId, value);
      if (result?.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {statuses.map((s) => (
        <div key={s.category_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium flex items-center gap-2">
              {s.category_name}
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
              value={editing[s.category_id] ?? ""}
              onChange={(e) => setEditing((prev) => ({ ...prev, [s.category_id]: e.target.value }))}
              onBlur={() => handleBlur(s.category_id, s.count_frequency_days)}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">dias (opcional)</span>
          </div>
          <StartCountButton categoryId={s.category_id} label="Iniciar contagem" />
        </div>
      ))}
    </div>
  );
}

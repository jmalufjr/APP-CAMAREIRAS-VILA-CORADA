"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceItemRow } from "@/lib/actions/maintenance";
import { completeMaintenanceNaoTecnico, completeMaintenanceTecnico } from "@/lib/actions/maintenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function MaintenanceChecklistDetail({
  categoryId,
  weekStart,
  weekEnd,
  naoTecnico,
  tecnico,
}: {
  categoryId: string;
  weekStart: string;
  weekEnd: string;
  naoTecnico: MaintenanceItemRow[];
  tecnico: MaintenanceItemRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [externalName, setExternalName] = useState("");

  if (naoTecnico.length === 0 && tecnico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum item selecionado por você nesta categoria no momento.
      </p>
    );
  }

  const allChecked = naoTecnico.length > 0 && naoTecnico.every((i) => checked[i.id]);

  return (
    <div className="space-y-6">
      {naoTecnico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Itens não técnicos (funcionário de manutenção)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {naoTecnico.map((item) => (
              <label key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={checked[item.id] ?? false}
                  onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [item.id]: v === true }))}
                />
                <div>
                  <p className="font-medium">{item.label}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                </div>
              </label>
            ))}
            <Button
              disabled={!allChecked || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await completeMaintenanceNaoTecnico(categoryId, weekStart, weekEnd);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Manutenção não técnica concluída.");
                    router.push("/manutencao/preventiva");
                  }
                });
              }}
            >
              Concluir manutenção não técnica
            </Button>
          </CardContent>
        </Card>
      )}

      {tecnico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Itens técnicos (técnico externo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tecnico.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{item.label}</p>
                {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
              </div>
            ))}
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="external-name">Nome do técnico externo</Label>
              <Input
                id="external-name"
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                placeholder="Ex.: João da assistência técnica"
              />
            </div>
            <Button
              disabled={!externalName.trim() || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await completeMaintenanceTecnico(categoryId, weekStart, weekEnd, externalName);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Manutenção técnica concluída.");
                    router.push("/manutencao/preventiva");
                  }
                });
              }}
            >
              Concluir com técnico externo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

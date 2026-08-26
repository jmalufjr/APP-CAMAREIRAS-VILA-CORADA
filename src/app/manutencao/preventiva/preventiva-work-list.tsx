"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceCategoryOverview } from "@/lib/actions/maintenance";
import { claimMaintenanceCategory } from "@/lib/actions/maintenance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function PreventivaWorkList({
  categories,
  currentUserId,
}: {
  categories: MaintenanceCategoryOverview[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum trabalho de manutenção preventiva previsto para hoje ou amanhã.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {categories.map((cat) => {
        const naoTecnicoCount = cat.items.filter((i) => i.execution_type === "nao_tecnico").length;
        const tecnicoCount = cat.items.filter((i) => i.execution_type === "tecnico").length;
        const hasPending = cat.items.some((i) => i.status === "pendente");
        const mySelected = cat.items.filter((i) => i.status === "selecionada" && i.selected_by === currentUserId);
        const otherSelected = cat.items.find((i) => i.status === "selecionada" && i.selected_by !== currentUserId);

        return (
          <Card key={cat.category_id}>
            <CardContent className="space-y-2">
              <p className="font-medium text-sm">{cat.category_name}</p>
              <p className="text-xs text-muted-foreground">
                {naoTecnicoCount} não técnico(s) · {tecnicoCount} técnico(s)
              </p>

              {mySelected.length > 0 && (
                <Badge variant="default">Selecionada por você</Badge>
              )}
              {mySelected.length === 0 && otherSelected && (
                <Badge variant="outline">
                  Selecionada por {otherSelected.selected_by_profile?.name ?? "outro funcionário"}
                </Badge>
              )}
              {mySelected.length === 0 && !otherSelected && <Badge variant="secondary">Pendente</Badge>}

              <div className="flex gap-2 pt-1">
                {hasPending && (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await claimMaintenanceCategory(cat.category_id);
                        if (result?.error) toast.error(result.error);
                        else {
                          toast.success("Categoria selecionada.");
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Selecionar
                  </Button>
                )}
                {mySelected.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link href={`/manutencao/preventiva/${cat.category_id}`}>
                        Abrir checklist <ArrowRight size={14} />
                      </Link>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

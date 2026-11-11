"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { moveLineToRecurring, moveLineToAsset, moveAssetToExpense } from "@/lib/actions/move-expense";

type Cat = { id: string; name: string };
const selectClass = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

// Botão "Mover" de uma linha de despesa (Relatório) ou de um bem (Ativo Permanente).
//  - despesa simples  -> despesa recorrente ou ativo permanente
//  - ativo permanente -> despesa (escolhendo a categoria)
export function MoveButton({
  mode,
  lineId,
  assetId,
  categories,
}: {
  mode: "expense" | "asset"; // o que o item é hoje
  lineId?: string;
  assetId?: string;
  categories: Cat[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState("");

  function run(fn: () => Promise<{ error?: string; message?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else {
        toast.success(r.message ?? "Movido.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="xs" className="shrink-0">
            <ArrowRightLeft size={12} /> Mover
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover item</DialogTitle>
          <DialogDescription>
            {mode === "expense" ? "Para onde este item deve ir?" : "O bem sai do ativo permanente e passa a contar como despesa do mês da compra."}
          </DialogDescription>
        </DialogHeader>
        {mode === "expense" ? (
          <div className="space-y-2">
            <Button className="w-full" variant="outline" disabled={isPending} onClick={() => run(() => moveLineToRecurring(lineId!))}>
              Despesa recorrente
            </Button>
            <p className="text-xs text-muted-foreground">
              Cadastra em &quot;Itens recorrentes&quot;. A despesa deste mês continua no relatório; a partir do mês seguinte é lançada sozinha.
            </p>
            <Button
              className="w-full"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                if (confirm("Mover para o ativo permanente? Deixa de contar como despesa do mês.")) run(() => moveLineToAsset(lineId!));
              }}
            >
              Ativo permanente
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Categoria da despesa</Label>
              <select className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Escolha…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button className="w-full" disabled={isPending || !categoryId} onClick={() => run(() => moveAssetToExpense({ lineId, assetId, categoryId }))}>
              Mover para despesa
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

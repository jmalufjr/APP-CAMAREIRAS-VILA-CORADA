"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DailyRoomTask, DailyRoomTaskCheck, DailyRoomTaskOccurrence, OccurrenceCategory } from "@/lib/types";
import { toggleCheck, addOccurrence, removeOccurrence, releaseTask } from "@/lib/actions/tasks";
import { setMinibarConsumption, type MinibarRoomConsumption } from "@/lib/actions/minibar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, CheckCircle2 } from "lucide-react";

type CheckRow = DailyRoomTaskCheck & { checklist_items: { label: string; description: string | null } };
type OccurrenceRow = DailyRoomTaskOccurrence & { occurrence_categories: { name: string } };

export function ChecklistDetail({
  task,
  checks,
  occurrences,
  categories,
  minibar,
}: {
  task: DailyRoomTask;
  checks: CheckRow[];
  occurrences: OccurrenceRow[];
  categories: OccurrenceCategory[];
  minibar: MinibarRoomConsumption;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [occDescription, setOccDescription] = useState("");

  // Estado local dos checks: a fonte de verdade da UI, atualizada de forma
  // otimista no clique. Evita esperar o round trip ao servidor + um
  // router.refresh() de página inteira só para o "xisinho" aparecer.
  const [localChecks, setLocalChecks] = useState(checks);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  // Ressincroniza o estado local sempre que a prop `checks` mudar de
  // identidade (task diferente / dados recarregados do servidor), sem usar
  // useEffect (padrão "adjusting state during render" do React).
  const [syncedChecks, setSyncedChecks] = useState(checks);
  if (checks !== syncedChecks) {
    setSyncedChecks(checks);
    setLocalChecks(checks);
  }

  const allChecked = localChecks.length > 0 && localChecks.every((c) => c.checked);
  const isReleased = task.status === "concluido";

  // Consumo de frigobar: quantidade por item, iniciada a partir do que já
  // está lançado na conta corrente deste quarto (compartilhada entre
  // qualquer camareira/tarefa). O toggle "houve consumo?" é só uma
  // conveniência de UI (default "Sim" se já existir alguma quantidade > 0
  // salva), não precisa de uma coluna própria no banco.
  const minibarItems = minibar.items;
  const isMinibarClosed = minibar.billStatus === "fechada";
  const initialQuantities = Object.fromEntries(minibarItems.map((item) => [item.id, item.quantity]));
  const [minibarQuantities, setMinibarQuantities] = useState<Record<string, number>>(initialQuantities);
  const [hasMinibarConsumption, setHasMinibarConsumption] = useState(
    Object.values(initialQuantities).some((q) => q > 0)
  );
  const [minibarPendingIds, setMinibarPendingIds] = useState<Set<string>>(new Set());

  function handleMinibarQuantityChange(itemId: string, quantity: number) {
    const safeQuantity = Math.max(0, Math.floor(quantity) || 0);
    setMinibarQuantities((prev) => ({ ...prev, [itemId]: safeQuantity }));
  }

  // Recebe a quantidade explicitamente (em vez de reler o estado) para
  // evitar salvar um valor obsoleto quando chamada logo após uma mudança de
  // estado ainda não aplicada (ex.: zerar tudo ao desligar o toggle).
  function saveMinibarQuantity(itemId: string, quantity: number) {
    setMinibarPendingIds((prev) => new Set(prev).add(itemId));
    startTransition(async () => {
      const result = await setMinibarConsumption(task.room_id, itemId, quantity);
      setMinibarPendingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(itemId);
        return copy;
      });
      if (result?.error) toast.error(result.error);
    });
  }

  function handleToggle(checkId: string, next: boolean) {
    setLocalChecks((prev) => prev.map((c) => (c.id === checkId ? { ...c, checked: next } : c)));
    setPendingIds((prev) => new Set(prev).add(checkId));

    startTransition(async () => {
      const result = await toggleCheck(checkId, next);
      setPendingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(checkId);
        return copy;
      });
      if (result?.error) {
        toast.error(result.error);
        // reverte apenas este item, sem recarregar a página inteira
        setLocalChecks((prev) => prev.map((c) => (c.id === checkId ? { ...c, checked: !next } : c)));
      }
    });
  }

  return (
    <div className="space-y-6">
      {isReleased && (
        <div className="flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-4 py-3 text-sm">
          <CheckCircle2 size={18} /> Quarto liberado.
        </div>
      )}

      <div className="space-y-2">
        {localChecks.map((check) => (
          <label
            key={check.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer"
          >
            <Checkbox
              checked={check.checked}
              disabled={pendingIds.has(check.id) || isReleased}
              onCheckedChange={(v) => handleToggle(check.id, !!v)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">{check.checklist_items.label}</p>
              {check.checklist_items.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {check.checklist_items.description}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg">Consumo de frigobar</h3>
            <div className="flex items-center gap-2">
              {isMinibarClosed && <Badge variant="secondary">Conta fechada</Badge>}
              <Label htmlFor="minibar-consumption" className="text-sm font-normal">
                Houve consumo de frigobar?
              </Label>
              <Switch
                id="minibar-consumption"
                checked={hasMinibarConsumption}
                disabled={isReleased || isMinibarClosed}
                onCheckedChange={(checked) => {
                  setHasMinibarConsumption(!!checked);
                  if (!checked) {
                    // Zera e salva todas as quantidades ao responder "Não".
                    minibarItems.forEach((item) => {
                      if ((minibarQuantities[item.id] ?? 0) > 0) {
                        handleMinibarQuantityChange(item.id, 0);
                        saveMinibarQuantity(item.id, 0);
                      }
                    });
                  }
                }}
              />
            </div>
          </div>
          {hasMinibarConsumption && (
            <div className="space-y-2">
              {minibarItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    disabled={minibarPendingIds.has(item.id) || isReleased || isMinibarClosed}
                    value={minibarQuantities[item.id] ?? 0}
                    onChange={(e) => handleMinibarQuantityChange(item.id, Number(e.target.value))}
                    onBlur={() => saveMinibarQuantity(item.id, minibarQuantities[item.id] ?? 0)}
                  />
                </div>
              ))}
              {minibarItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum item de frigobar cadastrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-heading text-lg">Ocorrências Manutenção</h3>
          <div className="space-y-2">
            {occurrences.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <div>
                  <Badge variant="secondary">{o.occurrence_categories.name}</Badge>
                  {o.description && <p className="text-sm mt-1">{o.description}</p>}
                </div>
                {!isReleased && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      startTransition(async () => {
                        await removeOccurrence(o.id);
                        router.refresh();
                      })
                    }
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!isReleased && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Categoria da ocorrência" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Descreva a ocorrência (opcional)"
                value={occDescription}
                onChange={(e) => setOccDescription(e.target.value)}
                className="flex-1 min-h-10"
              />
              <Button
                disabled={!categoryId || isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await addOccurrence(task.id, categoryId, occDescription);
                    if (result?.error) toast.error(result.error);
                    else {
                      setCategoryId("");
                      setOccDescription("");
                      router.refresh();
                    }
                  })
                }
              >
                Registrar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!isReleased && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-heading text-lg">Observações finais</h3>
            <Textarea
              placeholder="Alguma observação sobre o trabalho realizado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!allChecked || isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await releaseTask(task.id, notes);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Quarto liberado.");
                    router.refresh();
                  }
                })
              }
            >
              {allChecked ? "Liberar quarto" : "Marque todos os itens para liberar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isReleased && task.notes && (
        <Card>
          <CardContent>
            <h3 className="font-heading text-lg mb-2">Observações</h3>
            <p className="text-sm text-muted-foreground">{task.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

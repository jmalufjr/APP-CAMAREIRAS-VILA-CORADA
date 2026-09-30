"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  DailyRoomTask,
  DailyRoomTaskCheck,
  DailyRoomTaskOccurrence,
  OccurrenceCategory,
  OccurrencePhotoView,
  RoomBillGuestSlot,
} from "@/lib/types";
import { toggleCheck, addOccurrence, removeOccurrence, releaseTask } from "@/lib/actions/tasks";
import { uploadOccurrencePhotos, deleteOccurrencePhoto } from "@/lib/actions/occurrence-photos";
import { compressImageForUpload } from "@/lib/image-compression";
import { setMinibarConsumption, type MinibarRoomConsumption } from "@/lib/actions/minibar";
import type { RoomBillSnapshot } from "@/lib/actions/room-bills";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, CheckCircle2, Info, Camera } from "lucide-react";

type CheckRow = DailyRoomTaskCheck & { checklist_items: { label: string; description: string | null } };
type OccurrenceRow = DailyRoomTaskOccurrence & {
  occurrence_categories: { name: string };
  photos: OccurrencePhotoView[];
};

export function ChecklistDetail({
  task,
  checks,
  occurrences,
  categories,
  minibar,
  minibarGuestSlot,
  minibarSnapshot,
}: {
  task: DailyRoomTask;
  checks: CheckRow[];
  occurrences: OccurrenceRow[];
  categories: OccurrenceCategory[];
  // Só passado pela tela da camareira: consumo editável da conta corrente
  // do quarto (steppers, grava a cada clique).
  minibar?: MinibarRoomConsumption;
  // A conta certa pra lançar esse frigobar (resolvida pela página, a
  // partir das contas que já existem pra suíte — ver
  // resolveAutoMinibarGuestSlot em room-bills.ts) — sempre passado junto
  // com `minibar`.
  minibarGuestSlot?: RoomBillGuestSlot;
  // Só passado pela visão somente-leitura do admin: retrato (não editável)
  // da conta vigente na data da tarefa, no mesmo formato usado em
  // "Consumo de Bar e Frigobar" > Consumo por quartos. Ver
  // getRoomBillSnapshotForDate — é o acumulado da conta até aquele ponto,
  // não só o que foi lançado exatamente naquele dia.
  minibarSnapshot?: RoomBillSnapshot;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [occDescription, setOccDescription] = useState("");
  // Fotos já escolhidas nesta tentativa de registro, ainda não enviadas
  // (só vão pro servidor quando a ocorrência é registrada). previewUrl é
  // liberado (revokeObjectURL) assim que a foto é removida da lista ou o
  // registro é concluído, pra não vazar memória.
  const [stagedPhotos, setStagedPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function addStagedPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newOnes = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setStagedPhotos((prev) => [...prev, ...newOnes]);
  }

  function removeStagedPhoto(index: number) {
    setStagedPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearStagedPhotos() {
    setStagedPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }

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
  const minibarItems = minibar?.items ?? [];
  const isMinibarClosed = minibar?.billStatus === "fechada";
  const initialQuantities = Object.fromEntries(minibarItems.map((item) => [item.id, item.quantity]));
  const [minibarQuantities, setMinibarQuantities] = useState<Record<string, number>>(initialQuantities);
  const [hasMinibarConsumption, setHasMinibarConsumption] = useState(
    Object.values(initialQuantities).some((q) => q > 0)
  );
  const [minibarPendingIds, setMinibarPendingIds] = useState<Set<string>>(new Set());

  // Recebe a quantidade explicitamente (em vez de reler o estado) para
  // evitar salvar um valor obsoleto quando chamada logo após uma mudança de
  // estado ainda não aplicada (ex.: zerar tudo ao desligar o toggle).
  function saveMinibarQuantity(itemId: string, quantity: number) {
    setMinibarPendingIds((prev) => new Set(prev).add(itemId));
    startTransition(async () => {
      const result = await setMinibarConsumption(task.room_id, itemId, quantity, minibarGuestSlot ?? "unica");
      setMinibarPendingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(itemId);
        return copy;
      });
      if (result?.error) toast.error(result.error);
    });
  }

  // Cada clique no stepper (+/-) já é a ação final do usuário (não há
  // "blur" como num campo de texto), então atualiza e salva no mesmo passo.
  function handleMinibarQuantityChange(itemId: string, quantity: number) {
    const safeQuantity = Math.max(0, Math.floor(quantity) || 0);
    setMinibarQuantities((prev) => ({ ...prev, [itemId]: safeQuantity }));
    saveMinibarQuantity(itemId, safeQuantity);
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
          <CheckCircle2 size={18} /> Suíte liberada.
        </div>
      )}

      <div className="space-y-2">
        {localChecks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <label className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer">
              <Checkbox
                checked={check.checked}
                disabled={pendingIds.has(check.id) || isReleased}
                onCheckedChange={(v) => handleToggle(check.id, !!v)}
              />
              <span className="text-base font-medium">{check.checklist_items.label}</span>
            </label>
            {check.checklist_items.description && (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                      <Info size={18} />
                    </Button>
                  }
                />
                <PopoverContent className="w-[min(20rem,85vw)] text-base" align="end">
                  {check.checklist_items.description}
                </PopoverContent>
              </Popover>
            )}
          </div>
        ))}
      </div>

      {minibar && (
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
          {isMinibarClosed && (
            <p className="text-xs text-muted-foreground">
              Lance esse consumo em Consumo por quartos &gt; Lançar consumo adicional.
            </p>
          )}
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
                  <QuantityStepper
                    value={minibarQuantities[item.id] ?? 0}
                    disabled={minibarPendingIds.has(item.id) || isReleased || isMinibarClosed}
                    onChange={(v) => handleMinibarQuantityChange(item.id, v)}
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
      )}

      {minibarSnapshot && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-heading text-lg">Consumo de frigobar e bar</h3>
              <p className="text-xs text-muted-foreground">
                Estado acumulado da conta da suíte vigente nessa data — não é só o que foi lançado
                exatamente nesse dia, e sim tudo que já constava na conta até esse ponto.
              </p>
            </div>
            {!minibarSnapshot.found ? (
              <p className="text-sm text-muted-foreground">
                Não foi encontrada nenhuma conta dessa suíte pra essa data.
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Frigobar</p>
                    <div className="space-y-1.5">
                      {minibarSnapshot.minibarItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span>
                            {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                          </span>
                          <span>R$ {item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                      {minibarSnapshot.minibarItems.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">Sem consumo.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Bar da piscina</p>
                    <div className="space-y-1.5">
                      {minibarSnapshot.poolbarItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span>
                            {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                          </span>
                          <span>R$ {item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                      {minibarSnapshot.poolbarItems.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">Sem consumo.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-border pt-2 space-y-1 text-sm max-w-md">
                  <div className="flex items-center justify-between">
                    <span>Total frigobar</span>
                    <span>R$ {minibarSnapshot.minibarTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total bar da piscina</span>
                    <span>R$ {minibarSnapshot.poolbarSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-xs">
                    <span>Taxa de serviço (10% sobre o bar){minibarSnapshot.serviceChargeWaived && " · isenta"}</span>
                    <span>R$ {minibarSnapshot.serviceCharge.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium pt-1">
                    <span>Total bar e frigobar</span>
                    <span>R$ {minibarSnapshot.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-heading text-lg">Ocorrências Manutenção</h3>
          <div className="space-y-2">
            {occurrences.map((o) => (
              <div key={o.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Badge variant="secondary">{o.occurrence_categories.name}</Badge>
                  {o.description && <p className="text-sm">{o.description}</p>}
                  {o.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {o.photos.map(
                        (p) =>
                          p.url && (
                            <div key={p.id} className="relative">
                              <a href={p.url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.url}
                                  alt="Foto da ocorrência"
                                  className="h-16 w-16 rounded-lg object-cover border border-border"
                                />
                              </a>
                              {!isReleased && (
                                <button
                                  type="button"
                                  className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 text-muted-foreground"
                                  onClick={() =>
                                    startTransition(async () => {
                                      await deleteOccurrencePhoto(p.id);
                                      router.refresh();
                                    })
                                  }
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          )
                      )}
                    </div>
                  )}
                </div>
                {!isReleased && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
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
            {occurrences.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma ocorrência de manutenção registrada.</p>
            )}
          </div>
          {!isReleased && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger className="sm:w-56">
                    <SelectValue placeholder="Categoria da ocorrência">
                      {(v: string) => categories.find((c) => c.id === v)?.name ?? v}
                    </SelectValue>
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
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addStagedPhotos(e.target.files);
                  e.target.value = "";
                }}
              />

              {stagedPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stagedPhotos.map((p, i) => (
                    <div key={p.previewUrl} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.previewUrl}
                        alt="Foto selecionada"
                        className="h-16 w-16 rounded-lg object-cover border border-border"
                      />
                      <button
                        type="button"
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 text-muted-foreground"
                        onClick={() => removeStagedPhoto(i)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || isUploadingPhotos}
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera size={16} /> {stagedPhotos.length > 0 ? "Adicionar mais fotos" : "Adicionar foto(s)"}
                </Button>
                <Button
                  disabled={!categoryId || isPending || isUploadingPhotos}
                  onClick={() => {
                    const photosToSend = stagedPhotos;
                    startTransition(async () => {
                      const result = await addOccurrence(task.id, categoryId, occDescription);
                      if (result?.error) {
                        toast.error(result.error);
                        return;
                      }
                      if (photosToSend.length > 0 && result.occurrenceId) {
                        setIsUploadingPhotos(true);
                        const compressed = await Promise.all(
                          photosToSend.map((p) => compressImageForUpload(p.file))
                        );
                        const formData = new FormData();
                        compressed.forEach((blob, i) => formData.append("files", blob, `foto-${i + 1}.jpg`));
                        const uploadResult = await uploadOccurrencePhotos(result.occurrenceId, formData);
                        setIsUploadingPhotos(false);
                        if (uploadResult?.error) {
                          toast.error(`Ocorrência registrada, mas houve erro ao enviar as fotos: ${uploadResult.error}`);
                        }
                      }
                      setCategoryId("");
                      setOccDescription("");
                      clearStagedPhotos();
                      router.refresh();
                    });
                  }}
                >
                  {isUploadingPhotos ? "Enviando fotos..." : "Registrar"}
                </Button>
              </div>
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
                    toast.success("Suíte liberada.");
                    router.refresh();
                  }
                })
              }
            >
              {allChecked ? "Liberar suíte" : "Marque todos os itens para liberar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isReleased && (
        <Card>
          <CardContent>
            <h3 className="font-heading text-lg mb-2">Observações</h3>
            <p className="text-sm text-muted-foreground">{task.notes || "Nenhuma observação registrada."}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

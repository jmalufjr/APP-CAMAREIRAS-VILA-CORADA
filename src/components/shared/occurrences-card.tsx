"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DailyRoomTaskOccurrence, OccurrenceCategory, OccurrencePhotoView } from "@/lib/types";
import { addOccurrence, removeOccurrence } from "@/lib/actions/tasks";
import { uploadOccurrencePhotos, deleteOccurrencePhoto } from "@/lib/actions/occurrence-photos";
import { compressImageForUpload } from "@/lib/image-compression";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Camera } from "lucide-react";

export type OccurrenceRow = DailyRoomTaskOccurrence & {
  occurrence_categories: { name: string };
  photos: OccurrencePhotoView[];
};

// Ocorrências de manutenção de um serviço — usada pela executora (checklist) e
// pela revisora (revisão). `canEdit` liga o registro/remoção de ocorrências e fotos.
export function OccurrencesCard({
  taskId,
  occurrences,
  categories,
  canEdit,
}: {
  taskId: string;
  occurrences: OccurrenceRow[];
  categories: OccurrenceCategory[];
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isReleased = !canEdit;
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


  return (
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
                      const result = await addOccurrence(taskId, categoryId, occDescription);
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

  );
}

"use client";

import { useRef, useState } from "react";
import type { OccurrenceCategory } from "@/lib/types";
import type { OccurrenceRow } from "@/components/shared/occurrences-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Camera } from "lucide-react";

// Ocorrência ainda não gravada: só existe na tela até a camareira finalizar o serviço
// (nada é salvo antes disso — nem ao voltar de tela).
export interface DraftOccurrence {
  key: string;
  categoryId: string;
  description: string;
  photos: { file: File; previewUrl: string }[];
}

export function DraftOccurrencesCard({
  drafts,
  onChange,
  categories,
  saved,
}: {
  drafts: DraftOccurrence[];
  onChange: (next: DraftOccurrence[]) => void;
  categories: OccurrenceCategory[];
  // Ocorrências já gravadas por versões antigas da tela (serviço iniciado antes da mudança): só leitura.
  saved: OccurrenceRow[];
}) {
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [staged, setStaged] = useState<{ file: File; previewUrl: string }[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function addStaged(files: FileList | null) {
    if (!files || files.length === 0) return;
    const more = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setStaged((prev) => [...prev, ...more]);
  }
  function removeStaged(index: number) {
    setStaged((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }
  function removeDraft(key: string) {
    const target = drafts.find((d) => d.key === key);
    target?.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    onChange(drafts.filter((d) => d.key !== key));
  }
  function addDraft() {
    if (!categoryId) return;
    onChange([
      ...drafts,
      { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, categoryId, description: description.trim(), photos: staged },
    ]);
    setCategoryId("");
    setDescription("");
    setStaged([]);
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="font-heading text-lg">Ocorrências Manutenção</h3>
        <div className="space-y-2">
          {saved.map((o) => (
            <div key={o.id} className="rounded-lg bg-muted px-3 py-2 space-y-1">
              <Badge variant="secondary">{o.occurrence_categories.name}</Badge>
              {o.description && <p className="text-sm">{o.description}</p>}
            </div>
          ))}
          {drafts.map((d) => (
            <div key={d.key} className="flex items-start justify-between gap-2 rounded-lg bg-muted px-3 py-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant="secondary">{categoryName(d.categoryId)}</Badge>
                {d.description && <p className="text-sm">{d.description}</p>}
                {d.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {d.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.previewUrl}
                        src={p.previewUrl}
                        alt="Foto da ocorrência"
                        className="h-16 w-16 rounded-lg object-cover border border-border"
                      />
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeDraft(d.key)}>
                <X size={16} />
              </Button>
            </div>
          ))}
          {saved.length === 0 && drafts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma ocorrência de manutenção registrada.</p>
          )}
        </div>

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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              addStaged(e.target.files);
              e.target.value = "";
            }}
          />

          {staged.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {staged.map((p, i) => (
                <div key={p.previewUrl} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt="Foto selecionada" className="h-16 w-16 rounded-lg object-cover border border-border" />
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 text-muted-foreground"
                    onClick={() => removeStaged(i)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()}>
              <Camera size={16} /> {staged.length > 0 ? "Adicionar mais fotos" : "Adicionar foto(s)"}
            </Button>
            <Button type="button" disabled={!categoryId} onClick={addDraft}>
              Adicionar ocorrência
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            As ocorrências só são enviadas quando você tocar em “Serviço na suíte finalizado”.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

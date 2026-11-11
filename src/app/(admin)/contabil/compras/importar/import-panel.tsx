"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupMessages, parseChat, type ChatGroup } from "@/lib/whatsapp-chat-parser";
import { compressImageForUpload } from "@/lib/image-compression";
import { importInboxEntry } from "@/lib/actions/purchase-inbox";

interface Prepared {
  zip: JSZip;
  groups: ChatGroup[];
  missingMedia: number;
}

export function ImportPanel() {
  const router = useRouter();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [from, setFrom] = useState("2026-11-01");
  const [busy, setBusy] = useState(false);
  const [firstImport, setFirstImport] = useState(false);
  const [progress, setProgress] = useState("");

  async function onFile(file: File | undefined) {
    setPrepared(null);
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const chatEntry = Object.values(zip.files).find((f) => !f.dir && /\.txt$/i.test(f.name));
      if (!chatEntry) {
        toast.error("Não encontrei o arquivo de conversa (.txt) dentro do .zip.");
        return;
      }
      const groups = groupMessages(parseChat(await chatEntry.async("string")));
      const missingMedia = groups.filter((g) => g.image && !findMedia(zip, g.image)).length;
      setPrepared({ zip, groups, missingMedia });
    } catch {
      toast.error("Não consegui abrir o arquivo. Envie o .zip exportado pelo WhatsApp (com mídia).");
    }
  }

  function findMedia(zip: JSZip, name: string) {
    const lower = name.toLowerCase();
    return Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().split("/").pop() === lower) ?? null;
  }

  const selected = prepared?.groups.filter((g) => g.date >= from && (g.image ? !!findMedia(prepared.zip, g.image) : true)) ?? [];

  async function run() {
    if (!prepared) return;
    setBusy(true);
    let created = 0;
    let repeated = 0;
    let failed = 0;
    for (const [i, g] of selected.entries()) {
      setProgress(`Lendo ${i + 1} de ${selected.length}…`);
      const fd = new FormData();
      fd.set("key", g.key);
      fd.set("sender", g.sender);
      fd.set("date", g.date);
      fd.set("time", g.time);
      fd.set("text", g.texts.join("\n"));
      if (firstImport) fd.set("detectRecurring", "1");
      if (g.image) {
        const entry = findMedia(prepared.zip, g.image);
        if (entry) {
          const isPdf = /\.pdf$/i.test(g.image);
          const blob = await entry.async("blob");
          if (isPdf) fd.set("file", new File([blob], g.image, { type: "application/pdf" }));
          else {
            const raw = new File([blob], g.image, { type: /\.png$/i.test(g.image) ? "image/png" : "image/jpeg" });
            const small = await compressImageForUpload(raw, 1800, 0.75);
            fd.set("file", new File([small], g.image.replace(/\.\w+$/, ".jpg"), { type: small.type || "image/jpeg" }));
          }
        }
      }
      const r = await importInboxEntry(fd);
      if (r.error) failed++;
      else if (r.status === "repetido") repeated++;
      else created++;
    }
    setBusy(false);
    setProgress("");
    toast.success(`${created} nova(s) na caixa de conferência · ${repeated} já importada(s) antes · ${failed} com problema.`);
    router.push(firstImport ? "/contabil/compras/recorrentes-sugeridos" : "/contabil/compras/caixa");
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1.5">
        <Label>Arquivo da conversa (.zip)</Label>
        <Input type="file" accept=".zip,application/zip" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
      </div>
      <div className="space-y-1.5">
        <Label>Importar a partir de</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy} />
        <p className="text-xs text-muted-foreground">O novo modelo começa em 01/11/2026; mensagens anteriores são ignoradas.</p>
      </div>
      <label className="flex items-start gap-2 text-sm rounded-lg border border-border bg-card p-3">
        <input type="checkbox" className="mt-1" checked={firstImport} onChange={(e) => setFirstImport(e.target.checked)} disabled={busy} />
        <span>
          <strong>Primeira importação (desde 01/11/2026)</strong>: além de ler as notas, a IA sugere quais despesas são
          recorrentes (energia, água, internet, salários, honorários…) para você cadastrar de uma vez em “Itens
          recorrentes”. Use só no primeiro arquivo; depois o cadastro é manual.
        </span>
      </label>
      {prepared && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-1">
          <p>
            <strong>{selected.length}</strong> item(ns) a importar ({selected.filter((g) => g.image).length} com foto,{" "}
            {selected.filter((g) => !g.image).length} só texto).
          </p>
          {prepared.missingMedia > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {prepared.missingMedia} foto(s) citada(s) na conversa não vieram no arquivo (exporte “incluindo mídia”) e serão ignoradas.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Mensagens só de texto (sem nota) também entram; você descarta na conferência o que não for compra.
          </p>
        </div>
      )}
      <Button onClick={run} disabled={busy || !prepared || selected.length === 0}>
        {busy ? progress || "Importando…" : "Ler notas e enviar para a caixa de conferência"}
      </Button>
    </div>
  );
}

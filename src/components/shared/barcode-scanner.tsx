"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScanBarcode } from "lucide-react";

// Leitura de código de barras/QR direto pela câmera do celular, usando a
// API nativa do navegador (BarcodeDetector) — sem nenhuma biblioteca
// externa. Suportada no Chrome/navegadores baseados em Chromium
// (inclusive no Android dos aparelhos Xiaomi/Samsung usados pelas
// camareiras). Em navegadores sem suporte (ex.: Safari mais antigo), o
// componente avisa e quem usa o app cai pra busca manual por nome — ver
// PRD_compras.md seção 12-F sobre essa escolha.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
    };
  }
}

export function BarcodeScannerButton({
  onScan,
  label = "Escanear código",
  formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
}: {
  onScan: (value: string) => void;
  label?: string;
  formats?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Limpa o erro da tentativa anterior assim que o diálogo reabre — ajuste
  // de estado durante a renderização (padrão já usado no projeto, ver
  // CLAUDE.md Parte 25), evita precisar de um setState síncrono dentro do
  // efeito abaixo.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setError(null);
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Checado direto na renderização (nunca guardado em estado) — se o
  // navegador não suporta, não há nenhum evento externo pra "esperar", é só
  // um fato já conhecido no momento do render.
  const supported = typeof window !== "undefined" && typeof window.BarcodeDetector === "function";

  useEffect(() => {
    if (!open || !supported) {
      stopCamera();
      return;
    }
    const detector = new window.BarcodeDetector!({ formats });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        async function tick() {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onScan(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            // frame ainda não pronto — ignora e tenta de novo
          }
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => setError("Não foi possível acessar a câmera. Verifique a permissão do navegador."));

    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline">
            <ScanBarcode size={16} /> {label}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aponte a câmera pro código</DialogTitle>
        </DialogHeader>
        {!supported ? (
          <p className="text-sm text-destructive">
            Este navegador não suporta leitura de código de barras pela câmera. Busque o item pelo nome.
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video ref={videoRef} className="w-full rounded-lg bg-black" muted playsInline />
        )}
      </DialogContent>
    </Dialog>
  );
}

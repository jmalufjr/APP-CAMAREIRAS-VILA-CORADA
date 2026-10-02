"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScanBarcode } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

// Leitura de código de barras/QR direto pela câmera do celular. Caminho
// principal: a API nativa do navegador (BarcodeDetector), sem nenhuma
// biblioteca externa — suportada no Chrome/navegadores baseados em
// Chromium (Android das camareiras). Caminho de reserva: a biblioteca
// ZXing, carregada sob demanda só quando a API nativa não existe (ex.:
// Safari do iPhone, usado pelo admin) — garante que a leitura funcione
// nos dois aparelhos, não só no Android. Ver PRD_compras.md seção 6.1/12-F.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
    };
  }
}

// Nosso nome de formato (mesma convenção usada com o BarcodeDetector
// nativo) → nome do enum do ZXing, usado só no caminho de reserva.
const ZXING_FORMAT_NAMES: Record<string, string> = {
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_128: "CODE_128",
  qr_code: "QR_CODE",
};

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
  const zxingControlsRef = useRef<IScannerControls | null>(null);

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
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
  }

  // Checado direto na renderização (nunca guardado em estado) — se o
  // navegador não suporta, não há nenhum evento externo pra "esperar", é só
  // um fato já conhecido no momento do render.
  const nativeSupported = typeof window !== "undefined" && typeof window.BarcodeDetector === "function";

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    let cancelled = false;

    if (nativeSupported) {
      const detector = new window.BarcodeDetector!({ formats });
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
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
    } else {
      // Carregado sob demanda — só pesa no navegador que realmente precisa
      // dele (sem BarcodeDetector nativo), não no fluxo comum via Android.
      (async () => {
        try {
          const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          if (cancelled || !videoRef.current) return;

          const hints = new Map();
          const possibleFormats = formats
            .map((f) => ZXING_FORMAT_NAMES[f])
            .filter((f): f is string => !!f)
            .map((f) => BarcodeFormat[f as keyof typeof BarcodeFormat]);
          if (possibleFormats.length > 0) hints.set(DecodeHintType.POSSIBLE_FORMATS, possibleFormats);

          const reader = new BrowserMultiFormatReader(hints);
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" } },
            videoRef.current,
            (result) => {
              if (result && !cancelled) {
                onScan(result.getText());
                setOpen(false);
              }
            }
          );
          if (cancelled) {
            controls.stop();
          } else {
            zxingControlsRef.current = controls;
          }
        } catch {
          if (!cancelled) setError("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
        }
      })();
    }

    return () => {
      cancelled = true;
      stopCamera();
    };
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
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video ref={videoRef} className="w-full rounded-lg bg-black" muted playsInline />
        )}
      </DialogContent>
    </Dialog>
  );
}

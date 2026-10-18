"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera } from "lucide-react";

// Abre a câmera com uma pré-visualização ao vivo e um botão explícito de
// "Capturar" — tanto no celular quanto no computador (webcam) — em vez de
// depender do atributo `capture` de um `<input type="file">`, que no
// desktop simplesmente abre o seletor de arquivos sem usar a câmera, e
// no celular tira a foto direto sem deixar enquadrar antes. Devolve a
// foto capturada como um File (JPEG), do mesmo jeito que um arquivo
// escolhido manualmente.
export function CameraCaptureButton({
  onCapture,
  label = "Tirar foto",
}: {
  onCapture: (file: File) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setError(null);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setError("Não foi possível acessar a câmera. Verifique a permissão do navegador."));

    return stopCamera;
  }, [open]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "foto.jpg", { type: "image/jpeg" }));
        setOpen(false);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline">
            <Camera size={16} /> {label}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enquadre a foto e capture</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-3">
            <video ref={videoRef} className="w-full rounded-lg bg-black" muted playsInline />
            <Button type="button" onClick={handleCapture} className="w-full">
              <Camera size={16} /> Capturar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

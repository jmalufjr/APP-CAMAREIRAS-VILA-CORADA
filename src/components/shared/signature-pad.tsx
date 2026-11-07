"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toPngDataUrl: () => string;
}

// Área para assinar com o dedo (ou mouse). Tamanho interno fixo (600x220) para a imagem
// salva ter sempre o mesmo tamanho e ficar leve; o CSS só a estica na tela.
export const SignaturePad = forwardRef<SignaturePadHandle, { disabled?: boolean; onChange?: (empty: boolean) => void }>(
  function SignaturePad({ disabled, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);

    function paintBackground() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function point(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    }

    function start(e: React.PointerEvent<HTMLCanvasElement>) {
      if (disabled) return;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.setPointerCapture(e.pointerId);
      drawing.current = true;
      if (empty) paintBackground();
      const p = point(e);
      ctx.strokeStyle = "#111111";
      ctx.fillStyle = "#111111";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      if (empty) {
        setEmpty(false);
        onChange?.(false);
      }
    }

    function move(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = canvasRef.current!.getContext("2d")!;
      const p = point(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    function end() {
      drawing.current = false;
    }

    function clear() {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setEmpty(true);
      onChange?.(true);
    }

    useImperativeHandle(ref, () => ({
      clear,
      isEmpty: () => empty,
      toPngDataUrl: () => canvasRef.current!.toDataURL("image/png"),
    }));

    return (
      <canvas
        ref={canvasRef}
        width={600}
        height={220}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="w-full touch-none rounded-lg border-2 border-dashed border-border bg-white"
        aria-label="Área para assinatura do hóspede"
      />
    );
  }
);

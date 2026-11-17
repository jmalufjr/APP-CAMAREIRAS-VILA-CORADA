"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// "Voltar" leva à página exatamente anterior (histórico do navegador). Só quando não há página anterior
// do próprio app (ex.: tela aberta direto por um link) usa o endereço padrão `href`.
export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        const cameFromApp = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin);
        if (cameFromApp && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <ArrowLeft size={15} /> {label}
    </Link>
  );
}

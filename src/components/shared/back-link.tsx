"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NAV_COUNT_KEY } from "@/components/shared/nav-tracker";

// "Voltar" leva à página exatamente anterior (histórico do navegador). Só quando não há página anterior
// do próprio app (ex.: tela aberta direto por um link) usa o endereço padrão `href`.
export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        let cameFromApp = false;
        try {
          cameFromApp = (Number(sessionStorage.getItem(NAV_COUNT_KEY) ?? "0") || 0) > 0;
        } catch {
          // sem sessionStorage: usa o endereço padrão
        }
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

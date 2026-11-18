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
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/20 dark:border-[#E8B85C]/50 dark:bg-[#E8B85C]/10 dark:text-[#E8B85C] dark:hover:bg-[#E8B85C]/20"
    >
      <ArrowLeft size={16} strokeWidth={2.25} /> {label}
    </Link>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Conta quantas vezes o usuário navegou DENTRO do app nesta aba (o "document.referrer" não muda em
// navegações internas, então não serve). O botão "Voltar" usa isso para saber se existe uma página
// anterior do app para onde voltar.
export const NAV_COUNT_KEY = "app-nav-count";

export function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      const n = Number(sessionStorage.getItem(NAV_COUNT_KEY) ?? "0") || 0;
      sessionStorage.setItem(NAV_COUNT_KEY, String(n + 1));
    } catch {
      // sem sessionStorage: o Voltar usa o endereço padrão
    }
  }, [pathname]);
  return null;
}

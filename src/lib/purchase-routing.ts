import { CENTER_LABELS, type CenterCode } from "@/lib/expense-model-types";

// Para onde vai o custo de uma linha de compra (texto para a pessoa conferir).
export function describeDestination(p: {
  rule: string | null | undefined;
  centers?: { center_code: CenterCode; pct: number }[];
  ingredient?: { bar_pct: number; split_mode: string; kind?: string } | null;
}): string {
  switch (p.rule) {
    case "nao_alocavel":
      return "Fora dos centros (impostos)";
    case "bebidas":
      return "Bar × Frigobar, pelas vendas do mês";
    case "alimentos": {
      const ing = p.ingredient;
      if (!ing) return "Café 100%";
      if (ing.split_mode === "bar_frigobar") return "Bar × Frigobar, pelas vendas do mês";
      const bar = Number(ing.bar_pct);
      return `Bar ${bar}% · Café ${Math.round((100 - bar) * 100) / 100}%`;
    }
    case "fixo": {
      const parts = (p.centers ?? []).filter((c) => Number(c.pct) > 0).map((c) => `${CENTER_LABELS[c.center_code]} ${Number(c.pct)}%`);
      return parts.length > 0 ? parts.join(" · ") : "Sem rateio cadastrado";
    }
    default:
      return "Categoria não escolhida";
  }
}

// "Salvar" rápido só quando o destino do custo é certo: tem categoria e, em Alimentos,
// o ingrediente foi reconhecido (sem ele o custo iria 100% ao Café, o que pode estar errado).
export function isUnsafeForQuickSave(l: { categoryId: string | null; rule: string | null; ingredientId: string | null }): boolean {
  if (!l.categoryId) return true;
  return l.rule === "alimentos" && !l.ingredientId;
}

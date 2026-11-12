// Categorias fixas do cardápio do bar da piscina.
export const POOLBAR_CATEGORIES = ["Petiscos", "Drinks", "Outras bebidas"] as const;
export type PoolbarCategory = (typeof POOLBAR_CATEGORIES)[number];

export function isPoolbarCategory(v: string | null | undefined): v is PoolbarCategory {
  return !!v && (POOLBAR_CATEGORIES as readonly string[]).includes(v);
}

// Bebida vendida no bar (Drinks + Outras bebidas; aceita o antigo "Bebidas"): base da
// divisão Bar × Frigobar pelas vendas do mês.
export function isBeverageCategory(cat: string | null | undefined): boolean {
  return /^(drinks|outras bebidas|bebida)/i.test(String(cat ?? ""));
}

// Só Petiscos e Drinks entram na "Rentabilidade de Petiscos e Drinks" e exigem ficha técnica.
export function isProfitabilityCategory(cat: string | null | undefined): boolean {
  return cat === "Petiscos" || cat === "Drinks";
}

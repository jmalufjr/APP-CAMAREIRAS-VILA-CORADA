import type { ProductType, UnitConversion } from "@/lib/types";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  revenda: "Revenda",
  ingrediente_receita: "Ingrediente de receita",
  material_consumo: "Material de consumo",
  material_limpeza: "Material de limpeza",
  embalagem: "Embalagem",
  outro: "Outro",
};

export const PRODUCT_TYPE_OPTIONS = (Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((value) => ({
  value,
  label: PRODUCT_TYPE_LABELS[value],
}));

// Sugestões de unidade-base (campo livre — o PRD fala em "unidade,
// garrafa, litro, mililitro, quilo, grama, pacote etc.").
export const COMMON_UNITS = ["un", "garrafa", "L", "ml", "kg", "g", "pacote", "caixa"];

// Pares métricos que dispensam cadastro de conversão: base "L" já entende
// "ml" (1 ml = 0,001 L), base "kg" entende "g" etc.
const METRIC_SIBLINGS: Record<string, { unit: string; factor: number }[]> = {
  l: [{ unit: "ml", factor: 0.001 }],
  ml: [{ unit: "L", factor: 1000 }],
  kg: [{ unit: "g", factor: 0.001 }],
  g: [{ unit: "kg", factor: 1000 }],
};

// Todas as unidades em que um produto pode ser comprado/usado numa
// receita: a base (fator 1), os pares métricos e as conversões
// cadastradas (estas vencem um par métrico de mesmo nome).
export function unitOptions(baseUnit: string, conversions: UnitConversion[]): UnitConversion[] {
  const out: UnitConversion[] = [{ unit_name: baseUnit, factor: 1 }];
  const seen = new Set([baseUnit.toLowerCase()]);
  conversions.forEach((c) => {
    if (seen.has(c.unit_name.toLowerCase())) return;
    seen.add(c.unit_name.toLowerCase());
    out.push({ unit_name: c.unit_name, factor: Number(c.factor) });
  });
  (METRIC_SIBLINGS[baseUnit.toLowerCase()] ?? []).forEach((m) => {
    if (seen.has(m.unit.toLowerCase())) return;
    seen.add(m.unit.toLowerCase());
    out.push({ unit_name: m.unit, factor: m.factor });
  });
  return out;
}

// Fator de uma unidade pra unidade-base; 1 se não achar (cai na base).
export function unitFactor(unitName: string | null | undefined, baseUnit: string, conversions: UnitConversion[]): number {
  if (!unitName) return 1;
  return unitOptions(baseUnit, conversions).find((u) => u.unit_name.toLowerCase() === unitName.toLowerCase())?.factor ?? 1;
}

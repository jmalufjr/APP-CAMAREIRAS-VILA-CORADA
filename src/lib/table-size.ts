import type { TableShape, TableSize } from "@/lib/types";

export const TABLE_SIZES: TableSize[] = ["pequeno", "medio", "grande"];

export const TABLE_SIZE_LABELS: Record<TableSize, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

// Cada tamanho é 50% maior que o anterior (médio = 1,5 × pequeno; grande = 1,5 × médio = 2,25 × pequeno).
const FACTOR: Record<TableSize, number> = { pequeno: 1, medio: 1.5, grande: 2.25 };

// Dimensões do tamanho PEQUENO de cada formato. Redonda e quadrada: 70 (diâmetro/lado). Retangular: o lado menor
// fica sempre em 70 e só o lado maior (a altura) muda; o tamanho grande é o da Mesa 7 (200 × 70).
const SMALL: Record<TableShape, { width: number; height: number }> = {
  round: { width: 70, height: 70 },
  square: { width: 70, height: 70 },
  rect: { width: 70, height: 200 / 2.25 },
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function tableDimensions(shape: TableShape, size: TableSize): { width: number; height: number } {
  const base = SMALL[shape];
  const f = FACTOR[size];
  // Retangular: o lado menor não muda (a proporção de 50% vale para o lado maior).
  return { width: shape === "rect" ? base.width : round1(base.width * f), height: round1(base.height * f) };
}

// Tamanho de uma mesa nova: redonda e quadrada começam pequenas e a retangular, grande.
export function defaultTableSize(shape: TableShape): TableSize {
  return shape === "rect" ? "grande" : "pequeno";
}

export function isTableSize(value: string): value is TableSize {
  return (TABLE_SIZES as string[]).includes(value);
}

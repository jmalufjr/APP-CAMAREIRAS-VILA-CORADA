import type { ChecklistType } from "@/lib/types";
import type { StaysReservationRaw } from "./client";
import { trocaNights } from "./troca-schedule";

// Diferença em dias (calendário, sem hora) entre duas datas "YYYY-MM-DD".
// Usa meia-noite UTC nas duas pontas de propósito — comparar strings de
// data com fuso horário embutido já causou bug real neste projeto antes
// (commit "Fix date logic using UTC calendar day instead of Brasília's").
export function daysBetween(fromDateKey: string, toDateKey: string): number {
  const a = Date.UTC(...(fromDateKey.split("-").map(Number) as [number, number, number]));
  const b = Date.UTC(...(toDateKey.split("-").map(Number) as [number, number, number]));
  return Math.round((b - a) / 86_400_000);
}

// Deriva o tipo de trabalho de um quarto num dia específico, a partir das
// reservas desse quarto (já filtradas por listing) — ver
// PRD_regrasdenegocio.md seção 2. Retorna null quando não há nenhuma
// reserva relevante naquele dia (quarto vago, sem trabalho definido pela
// Stays).
export function deriveWorkType(
  roomReservations: StaysReservationRaw[],
  dateKey: string
): ChecklistType | null {
  const checkingOut = roomReservations.find((r) => r.checkOutDate === dateKey);
  const checkingIn = roomReservations.find((r) => r.checkInDate === dateKey);

  if (checkingOut && checkingIn) return "preparacao"; // Saída com Chegada
  if (checkingOut) return "somente_saida";
  if (checkingIn) return "somente_chegada";

  const staying = roomReservations.find((r) => r.checkInDate < dateKey && dateKey < r.checkOutDate);
  if (staying) {
    const nightsElapsed = daysBetween(staying.checkInDate, dateKey);
    const totalNights = daysBetween(staying.checkInDate, staying.checkOutDate);
    return trocaNights(totalNights).includes(nightsElapsed) ? "troca" : "arrumacao";
  }

  return null;
}

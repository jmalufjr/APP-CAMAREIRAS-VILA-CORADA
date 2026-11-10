// Feriados NACIONAIS do Brasil (sem Carnaval nem Corpus Christi, que são pontos facultativos).
// Funções puras, só calendário ("YYYY-MM-DD", sem fuso).

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function easterSunday(year: number): { m: number; d: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

const FIXED = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

export function isNationalHoliday(dateKey: string): boolean {
  const year = Number(dateKey.slice(0, 4));
  if (FIXED.includes(dateKey.slice(5))) return true;
  // Sexta-feira Santa = 2 dias antes da Páscoa.
  const easter = easterSunday(year);
  const goodFriday = new Date(Date.UTC(year, easter.m - 1, easter.d - 2)).toISOString().slice(0, 10);
  return dateKey === goodFriday;
}

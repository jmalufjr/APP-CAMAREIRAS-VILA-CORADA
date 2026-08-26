export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
}

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

export function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
}

export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function monthsAgoKey(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toDateKey(d);
}

// Segunda-feira da semana (seg-sex) que contém a data informada.
export function mondayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 = domingo, 1 = segunda, ... 6 = sábado
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toDateKey(date);
}

// Sexta-feira da semana (seg-sex) que contém a data informada.
export function fridayKey(dateKey: string): string {
  return addDaysKey(mondayKey(dateKey), 4);
}

export function formatDateRangePt(fromKey: string, toKey: string): string {
  const fmt = (k: string) => k.split("-").slice(1).reverse().join("/");
  return `${fmt(fromKey)} a ${fmt(toKey)}`;
}

export function formatDatePt(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

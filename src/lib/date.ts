export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

// "Agora", mas nos valores de calendário/relógio de Brasília — não os do
// processo que executa o código (a Vercel roda em UTC; localhost pode estar
// em qualquer fuso do sistema). Sem isso, todo lugar que partia de
// `new Date()` para achar "hoje" trocava de dia à meia-noite UTC (21h em
// Brasília, UTC-3) — "hoje"/"amanhã" e os fechamentos de mês viravam cedo
// demais.
//
// Construído com `Date.UTC(...)` (não o construtor local `new Date(y,m,d)`)
// para que o resultado seja o mesmo não importa o fuso do sistema: os
// valores de Brasília são "carimbados" diretamente como se fossem UTC, sem
// nenhuma reinterpretação de fuso. Por isso, todo código que deriva algo
// a partir do valor retornado (`tomorrowKey`, `monthRange` etc.) **precisa
// usar os métodos `getUTC*`/`setUTC*`**, nunca os locais (`getDate`,
// `getMonth`...) — misturar os dois quebra a garantia de novo.
export function nowInBrazil(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  );
}

export function todayKey(): string {
  return toDateKey(nowInBrazil());
}

export function tomorrowKey(): string {
  const d = nowInBrazil();
  d.setUTCDate(d.getUTCDate() + 1);
  return toDateKey(d);
}

export function yesterdayKey(): string {
  const d = nowInBrazil();
  d.setUTCDate(d.getUTCDate() - 1);
  return toDateKey(d);
}

export function daysAgoKey(n: number): string {
  const d = nowInBrazil();
  d.setUTCDate(d.getUTCDate() - n);
  return toDateKey(d);
}

export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function monthsAgoKey(months: number): string {
  const d = nowInBrazil();
  d.setUTCMonth(d.getUTCMonth() - months);
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

export function formatDateShortPt(dateKey: string): string {
  return dateKey.split("-").reverse().join("/");
}

export function formatDatePt(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

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

// Construído com `Date.UTC(...)` (não o construtor local `new Date(y,m,d)`)
// pela mesma razão de `nowInBrazil`: o construtor local depende do fuso do
// processo que roda o código, e `toDateKey` sempre lê de volta em UTC — se
// os dois usarem fusos diferentes, a data final pode sair errada. Com
// `Date.UTC`, o resultado é sempre o mesmo, não importa o fuso do sistema.
export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function monthsAgoKey(months: number): string {
  const d = nowInBrazil();
  d.setUTCMonth(d.getUTCMonth() - months);
  return toDateKey(d);
}

// Segunda-feira da semana (seg-sex) que contém a data informada. Mesmo
// motivo de `addDaysKey` pra usar `Date.UTC`/métodos UTC em vez dos locais.
export function mondayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 = domingo, 1 = segunda, ... 6 = sábado
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
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

// Formata um timestamp ISO (timestamptz do banco) como "dd/mm hh:mm" no
// horário de Brasília, independentemente do fuso do processo que roda o código.
export function formatDateTimePt(isoString: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoString));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

// Formata um timestamp ISO como "hh:mm" no horário de Brasília, sem a
// data — usado quando a data do serviço já aparece em outra coluna da
// mesma tabela (ex.: "Início"/"Término" no card de serviços recentes).
export function formatTimePt(isoString: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoString));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

// Início "efetivo" de um serviço para fins de exibição/duração: usa
// claimed_at (o momento em que a camareira escolheu o quarto) quando
// existir. Serviços concluídos antes dessa coluna existir no banco não
// têm claimed_at — para esses (só para esses), cai para started_at
// (início do checklist) como aproximação. Isso não redefine o
// significado de "Início" para serviços novos, que sempre têm claimed_at.
export function effectiveServiceStart(claimedAt: string | null, startedAt: string | null): string | null {
  return claimedAt ?? startedAt;
}

// Duração em minutos entre dois timestamps ISO (ex.: claimed_at →
// finished_at), ou null se qualquer um dos dois estiver ausente — usado
// para agregações (ex.: média por camareira no Histórico) antes de
// formatar uma única vez com formatMinutesPt.
export function durationMinutes(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 60000;
}

// Formata um número de minutos (já calculado) como "1h 23min" ou "45min".
export function formatMinutesPt(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return h === 0 ? `${m}min` : `${h}h ${m}min`;
}

// Formata a duração entre dois timestamps ISO como "1h 23min"/"45min", ou
// "—" quando qualquer um dos dois estiver ausente (ex.: tarefa concluída
// antes de claimed_at existir).
export function formatDurationPt(startIso: string | null, endIso: string | null): string {
  const mins = durationMinutes(startIso, endIso);
  return mins === null ? "—" : formatMinutesPt(mins);
}

// Limite superior EXCLUSIVO pra filtrar uma coluna timestamptz (instante
// real, ex.: profiles.created_at) de forma que só entrem valores que
// caem em `dateKey` (ou antes) na hora de Brasília — não um "23:59:59"
// ingênuo comparado como se já fosse UTC, que erraria por até 3h (Brasil
// é UTC-3 e não observa horário de verão desde 2019, sem complicação
// extra de DST). Meia-noite de Brasília do dia seguinte a `dateKey`
// corresponde a 03:00 UTC desse mesmo dia seguinte.
export function nextDayBrasiliaUtcBoundary(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0)).toISOString();
}

// Limite inferior INCLUSIVO complementar a `nextDayBrasiliaUtcBoundary`:
// meia-noite de Brasília de `dateKey`, já em UTC (03:00 UTC desse mesmo
// dia) — pra filtrar uma coluna timestamptz de forma que só entrem
// valores que caem em `dateKey` (ou depois) na hora de Brasília.
export function startOfDayBrasiliaUtc(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).toISOString();
}

// Em que dia de calendário, na hora de Brasília, um instante real caiu —
// nunca fatiar os primeiros 10 caracteres de um ISO string pra isso (dá o
// dia em UTC, que já é o dia seguinte pra qualquer horário entre 21h e
// 23h59 de Brasília, já que Brasília é UTC-3). Usado sempre que um
// timestamptz do banco (ex.: paid_at, created_at) precisa virar uma
// "data" pra agrupar por dia/mês/período.
export function dateKeyInBrazil(isoString: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoString));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// "Setembro de 2026" a partir de uma data qualquer daquele mês (usa só
// ano/mês da string, ignora o dia) — usado pra rotular "Último período
// (mês)" nas telas/PDF/e-mail de comissão.
export function monthYearLabelPt(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDatePt(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

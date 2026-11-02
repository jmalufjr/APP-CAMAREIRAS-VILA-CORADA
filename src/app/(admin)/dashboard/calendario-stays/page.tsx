import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { addDaysKey, nowInBrazil, toDateKey, todayKey } from "@/lib/date";
import { getStaysCalendar } from "@/lib/actions/stays-calendar";
import { StaysCalendarGrid } from "./stays-calendar-grid";

function defaultRange() {
  const now = nowInBrazil();
  const start = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  return { from: start, to: addDaysKey(todayKey(), 60) };
}

// Calendário de reservas — Stays: reproduz o "Calendário Geral" da Stays com as
// reservas, pré-reservas, contratos e bloqueios das suítes. Somente consulta.
export default async function CalendarioStaysPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;

  const result = await getStaysCalendar(from, to);

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Calendário de reservas - Stays"
        subtitle="Reservas, pré-reservas, contratos e bloqueios de cada suíte, dia a dia, direto da Stays."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">De</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            required
            className="block h-9 rounded-md border border-input bg-background px-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Até</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            required
            className="block h-9 rounded-md border border-input bg-background px-2"
          />
        </label>
        <Button type="submit">Atualizar</Button>
      </form>

      {!result.rows ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {result.error}
        </p>
      ) : (
        <StaysCalendarGrid rows={result.rows} from={from} to={to} today={todayKey()} />
      )}
    </div>
  );
}

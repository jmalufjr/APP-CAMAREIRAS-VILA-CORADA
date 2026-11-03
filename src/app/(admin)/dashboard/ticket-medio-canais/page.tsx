import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimePt, monthYearLabelPt, todayKey } from "@/lib/date";
import { CHANNELS, ROOM_GROUPS, monthKeys, type ChannelKey } from "@/lib/stays/channel-stats";
import { ChannelSettingsCard } from "./channel-settings-card";

interface StatRow {
  group_key: string;
  channel: string;
  month: string;
  nights: number;
  charged_total: number;
  base_avg: number | null;
  base_days: number;
  registered_total: number;
  matched_nights: number;
  matched_charged: number;
  synced_at: string;
}

const money = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function variation(v: number | null) {
  if (v === null) return <span>—</span>;
  const sign = v > 0 ? "+" : "";
  const color = v > 0.05 ? "text-emerald-600 dark:text-emerald-400" : v < -0.05 ? "text-red-600 dark:text-red-400" : "";
  return <span className={color}>{`${sign}${v.toFixed(1).replace(".", ",")}%`}</span>;
}

// Ticket médio de canais de venda: por grupo de suítes (de mesmo preço) e canal, os
// próximos 6 meses com: diárias reservadas, preço médio cadastrado (preço base da Stays
// × correção do canal), ticket médio efetivamente cobrado nas diárias e a variação
// entre os dois. Dados gravados pela sincronização com a Stays (cron diário e botões).
export default async function TicketMedioCanaisPage() {
  const supabase = await createClient();
  const months = monthKeys(todayKey(), 6);

  const [{ data: settings }, { data: stats }] = await Promise.all([
    supabase.from("channel_price_settings").select("channel, correction_pct"),
    supabase.from("channel_ticket_stats").select("*").in("month", months),
  ]);

  const correction = {} as Record<ChannelKey, number | null>;
  CHANNELS.forEach((c) => (correction[c.key] = null));
  (settings ?? []).forEach((s) => {
    correction[s.channel as ChannelKey] = s.correction_pct === null ? null : Number(s.correction_pct);
  });

  const byKey = new Map<string, StatRow>();
  let lastSync: string | null = null;
  ((stats ?? []) as StatRow[]).forEach((r) => {
    byKey.set(`${r.group_key}|${r.channel}|${r.month}`, r);
    if (!lastSync || r.synced_at > lastSync) lastSync = r.synced_at;
  });

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Ticket médio de canais de venda"
        subtitle="Preço cadastrado e preço efetivamente cobrado, por suíte e canal de venda, nos próximos 6 meses."
      />

      <ChannelSettingsCard initial={correction} />

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          <strong>Diárias reservadas</strong>: noites reservadas no mês pela suíte neste canal (cada noite conta no dia
          em que começa; reservas confirmadas, pré-reservas e contratos, sem canceladas).{" "}
          <strong>Preço médio cadastrado</strong>: média dos preços de todos os dias do mês na Stays, já com a correção do
          canal. <strong>Ticket médio cadastrado</strong>: o preço cadastrado (com a correção do canal) apenas dos
          dias das diárias reservadas, ou seja, a mesma base de dias do ticket cobrado.{" "}
          <strong>Ticket médio cobrado</strong>: valor das diárias cobrado nas reservas ÷ diárias do mês (sem taxas
          como ISS). <strong>Variação</strong>: ticket cobrado em relação ao ticket cadastrado, nos mesmos dias — o
          desconto (negativo) ou ágio (positivo) real do canal.
        </p>
        <p>
          No mês atual, o preço cadastrado considera só os dias de hoje em diante (a Stays não informa os dias já
          passados).{" "}
          {lastSync ? `Atualizado em ${formatDateTimePt(lastSync)}.` : "Ainda não sincronizado."} A atualização é
          automática uma vez por dia e também ocorre nos botões de sincronização com a Stays.
        </p>
      </div>

      {!lastSync ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          Ainda não há dados. Use os botões de sincronização com a Stays (menu Sincronização) para carregar a tabela.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 min-w-48 border-b border-r border-border bg-muted px-3 py-2 text-left">
                  Canal
                </th>
                {months.map((m) => (
                  <th key={m} colSpan={5} className="border-b border-l border-border px-3 py-2 text-center">
                    {monthYearLabelPt(m)}
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/60 text-xs">
                <th className="sticky left-0 z-10 border-b border-r border-border bg-muted/60 px-3 py-1" />
                {months.map((m) => (
                  <HeaderCells key={m} />
                ))}
              </tr>
            </thead>
            <tbody>
              {ROOM_GROUPS.map((g) => (
                <GroupRows key={g.key} groupKey={g.key} label={g.label} months={months} byKey={byKey} correction={correction} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HeaderCells() {
  return (
    <>
      <th className="border-b border-l border-border px-2 py-1 font-medium">Diárias reservadas</th>
      <th className="border-b border-border px-2 py-1 font-medium">Preço médio cadastrado</th>
      <th className="border-b border-border px-2 py-1 font-medium">Ticket médio cadastrado</th>
      <th className="border-b border-border px-2 py-1 font-medium">Ticket médio cobrado</th>
      <th className="border-b border-border px-2 py-1 font-medium">Variação</th>
    </>
  );
}

function GroupRows({
  groupKey,
  label,
  months,
  byKey,
  correction,
}: {
  groupKey: string;
  label: string;
  months: string[];
  byKey: Map<string, StatRow>;
  correction: Record<ChannelKey, number | null>;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={1 + months.length * 5}
          className="sticky left-0 border-b border-border bg-secondary px-3 py-1.5 font-heading text-base text-secondary-foreground"
        >
          {label}
        </td>
      </tr>
      {CHANNELS.map((c) => (
        <tr key={c.key} className="hover:bg-accent/40">
          <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-border bg-card px-3 py-1.5">
            {c.label}
          </td>
          {months.map((m) => {
            const row = byKey.get(`${groupKey}|${c.key}|${m}`);
            const nights = row?.nights ?? 0;
            const pct = correction[c.key];
            const factor = pct !== null ? 1 + pct / 100 : null;
            // preço médio cadastrado: todos os dias do mês com preço na Stays
            const registered = row?.base_avg != null && factor !== null ? Number(row.base_avg) * factor : null;
            // ticket cobrado: todas as diárias reservadas do mês
            const charged = row && nights > 0 ? Number(row.charged_total) / nights : null;
            // ticket cadastrado e variação: só as diárias reservadas que têm preço cadastrado,
            // com o cobrado e o cadastrado medidos nos MESMOS dias
            const matched = row?.matched_nights ?? 0;
            const registeredTicket =
              row && matched > 0 && factor !== null ? (Number(row.registered_total) * factor) / matched : null;
            const delta =
              row && matched > 0 && factor !== null && Number(row.registered_total) > 0
                ? (Number(row.matched_charged) / (Number(row.registered_total) * factor) - 1) * 100
                : null;
            return (
              <MonthCells
                key={m}
                nights={nights}
                registered={registered}
                registeredTicket={registeredTicket}
                charged={charged}
                delta={delta}
              />
            );
          })}
        </tr>
      ))}
    </>
  );
}

function MonthCells({
  nights,
  registered,
  registeredTicket,
  charged,
  delta,
}: {
  nights: number;
  registered: number | null;
  registeredTicket: number | null;
  charged: number | null;
  delta: number | null;
}) {
  return (
    <>
      <td className="border-b border-l border-border px-2 py-1.5 text-center tabular-nums">{nights}</td>
      <td className="whitespace-nowrap border-b border-border px-2 py-1.5 text-right tabular-nums">{money(registered)}</td>
      <td className="whitespace-nowrap border-b border-border px-2 py-1.5 text-right tabular-nums">{money(registeredTicket)}</td>
      <td className="whitespace-nowrap border-b border-border px-2 py-1.5 text-right tabular-nums">{money(charged)}</td>
      <td className="whitespace-nowrap border-b border-border px-2 py-1.5 text-right tabular-nums">{variation(delta)}</td>
    </>
  );
}

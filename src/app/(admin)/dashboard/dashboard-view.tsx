"use client";

import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BedDouble,
  CalendarClock,
  Coffee,
  CreditCard,
  Key,
  Percent,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GerencialDashboard, OperationalDashboard, RankedItem } from "@/lib/dashboard-data";
import { TASK_STATUS_LABELS } from "@/lib/types";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);

// Valor em destaque: bordô no tema claro, dourado nos escuros (mesma regra dos cards do app).
const VALUE_COLOR = "text-primary dark:text-[#E8B85C]";

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  href,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: "alert";
}) {
  const body = (
    <Card size="sm" className={href ? "transition-colors hover:bg-accent/40" : undefined}>
      <CardContent className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon size={14} strokeWidth={1.75} className="shrink-0" />
          <span className="min-w-0 truncate">{label}</span>
        </div>
        <p className={`text-xl font-bold leading-none ${tone === "alert" ? "text-red-600 dark:text-red-400" : VALUE_COLOR}`}>{value}</p>
        {sub && <p className="text-[11px] leading-tight text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle className="font-heading text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Ranking horizontal simples (barras proporcionais ao maior valor, só por quantidade).
function RankList({ title, items }: { title: string; items: RankedItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.quantity));
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem consumo registrado.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((i, idx) => (
            <li key={i.name} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{idx + 1}.</span> {i.name}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{i.quantity}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-[var(--chart-1)] dark:bg-[#E8B85C]" style={{ width: `${(i.quantity / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function SuiteChips({ rooms, empty }: { rooms: string[]; empty: string }) {
  if (rooms.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {rooms.map((n) => (
        <span key={n} className="rounded-md border border-border px-1.5 py-0.5 text-xs font-medium">
          {n}
        </span>
      ))}
    </div>
  );
}

const STATUS_SEGMENTS = [
  { key: "done", label: TASK_STATUS_LABELS.concluido, color: "bg-emerald-600" },
  { key: "review", label: "Em revisão/correção", color: "bg-[var(--chart-4)]" },
  { key: "inProgress", label: TASK_STATUS_LABELS.em_andamento, color: "bg-[var(--chart-2)]" },
  { key: "pending", label: TASK_STATUS_LABELS.pendente, color: "bg-muted-foreground/40" },
] as const;

function OperationalView({ d }: { d: OperationalDashboard }) {
  const s = d.services;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={BedDouble} label="Serviços concluídos hoje" value={`${s.done} / ${s.total}`} href="/dashboard/servicos-suites" />
        <Kpi
          icon={Percent}
          label="Pendentes de revisão"
          value={String(d.pendingReview)}
          sub="em qualquer dia"
          href="/planejamento"
          tone={d.pendingReview > 0 ? "alert" : undefined}
        />
        <Kpi icon={AlertTriangle} label="Ocorrências hoje" value={String(d.occurrences.today)} sub={`${d.occurrences.open} em aberto no total`} href="/ocorrencias" />
        <Kpi icon={CalendarClock} label="Chegadas / saídas hoje" value={`${d.arrivals} / ${d.departures}`} href="/chegadas-saidas/gerenciar" />
        <Kpi icon={Coffee} label="Café hoje" value={`${d.breakfast.tables} mesas`} sub={`${d.breakfast.guests} hóspedes`} href="/mesas/gerenciar" />
        <Kpi icon={CreditCard} label="Contas em aberto" value={String(d.accounts.open)} sub={brl(d.accounts.total)} href="/frigobar" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Serviços de hoje">
          {s.total === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum serviço planejado para hoje.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {STATUS_SEGMENTS.map((seg) => {
                  const n = s[seg.key];
                  return n > 0 ? <div key={seg.key} className={seg.color} style={{ width: `${(n / s.total) * 100}%` }} title={`${seg.label}: ${n}`} /> : null;
                })}
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {STATUS_SEGMENTS.map((seg) => (
                  <li key={seg.key} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${seg.color}`} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{seg.label}</span>
                    <span className="font-semibold tabular-nums">{s[seg.key]}</span>
                  </li>
                ))}
              </ul>
              {s.cancelled > 0 && <p className="text-[11px] text-muted-foreground">{s.cancelled} cancelado(s) não entram na conta.</p>}
            </div>
          )}
        </Panel>

        <Panel title="Suítes vagas, disponíveis para alugar">
          <div className="space-y-3">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                <Key size={13} /> Limpas ({d.suites.clean.length})
              </p>
              <SuiteChips rooms={d.suites.clean} empty="Nenhuma suíte limpa e vaga." />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Sujas ({d.suites.dirty.length})</p>
              <SuiteChips rooms={d.suites.dirty} empty="Nenhuma suíte suja e vaga." />
            </div>
            <Link href="/dashboard/suites-disponiveis" className="text-xs text-primary hover:underline">
              Ver detalhes
            </Link>
          </div>
        </Panel>

        <Panel title="Manutenção">
          <div className="space-y-2 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Ocorrências hoje</span>
              <span className="text-base font-bold tabular-nums">{d.occurrences.today}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Em aberto (pendentes ou selecionadas)</span>
              <span className="text-base font-bold tabular-nums">{d.occurrences.open}</span>
            </div>
            <div className="flex gap-3 pt-1">
              <Link href="/ocorrencias" className="text-primary hover:underline">
                Ver ocorrências
              </Link>
              <Link href="/manutencao-preventiva" className="text-primary hover:underline">
                Manutenção preventiva
              </Link>
            </div>
          </div>
        </Panel>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Mais consumidos desde o início (por quantidade)</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RankList title="Frigobar" items={d.top.frigobar} />
          <RankList title="Bar · Petiscos" items={d.top.petiscos} />
          <RankList title="Bar · Drinks" items={d.top.drinks} />
          <RankList title="Bar · Outras bebidas" items={d.top.bebidas} />
        </div>
      </div>
    </div>
  );
}

const CENTER_LABELS: Record<string, string> = { hospedagem: "Hospedagem e café da manhã", bar: "Bar", frigobar: "Frigobar" };

function monthShort(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

const score = (v: number | null) => (v === null ? "—" : v.toFixed(2).replace(".", ","));

// Cores do gráfico (legíveis nos três temas).
const C_REVENUE = "#94A3B8";
const C_CURRENT = "#E8B85C";
const C_PROFIT = "#059669";
const C_OCC = "#2563EB";
const C_ADR = "#7C3AED";
const C_REVPAR = "#DB2777";

function CentersPanel({ title, rows, note }: { title: string; rows: GerencialDashboard["centersCurrent"]; note?: string }) {
  const max = Math.max(1, ...rows.flatMap((c) => [c.revenue, c.expenses]));
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((c) => (
            <div key={c.center} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium">{CENTER_LABELS[c.center] ?? c.center}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {brl0(c.revenue)} − {brl0(c.expenses)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-[var(--chart-2)] dark:bg-[#E8B85C]" style={{ width: `${(Math.max(c.revenue, 0) / max) * 100}%` }} />
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-[var(--chart-1)] dark:bg-[#B08968]" style={{ width: `${(Math.max(c.expenses, 0) / max) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Barra de cima: receita · barra de baixo: despesa.{note ? ` ${note}` : ""}</p>
        </div>
      )}
    </Panel>
  );
}

function GerencialView({ d, isGerente }: { d: GerencialDashboard; isGerente: boolean }) {
  const r = d.result;
  const ind = d.indicators;
  const monthLabel = monthShort(d.month);
  const sinceLabel = monthShort(d.windowStart);
  const maxExpense = Math.max(1, ...d.expenseRanking.flatMap((e) => [e.current, e.average]));
  const chartData = d.series.map((p) => ({ ...p, label: monthShort(p.month), occPct: p.occ === null ? null : Math.round(p.occ * 100) }));
  const hasChart = d.series.some((p) => p.revenue !== null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          icon={Wallet}
          label="Lucro gerencial do mês"
          value={r ? brl0(r.operating) : "—"}
          sub={`${monthLabel} · parcial`}
          href="/contabil/resultado-mensal"
          tone={r && r.operating < 0 ? "alert" : undefined}
        />
        <Kpi icon={TrendingUp} label="Receita do mês" value={r ? brl0(r.revenue) : "—"} sub="hospedagem líquida + bar + frigobar" href="/contabil/resultado-mensal" />
        <Kpi icon={CreditCard} label="Despesas do mês" value={r ? brl0(r.expenses) : "—"} sub="regime caixa, rateadas" href="/contabil/compras/relatorio" />
        <Kpi
          icon={BedDouble}
          label="Diária média (ADR)"
          value={ind?.current?.adr != null ? brl0(ind.current.adr) : "—"}
          sub={`${ind?.current?.paid ?? 0} diárias vendidas`}
          href={isGerente ? undefined : "/dashboard/indicadores"}
        />
        <Kpi
          icon={Percent}
          label="Ocupação comercial"
          value={pct(ind?.current?.occ ?? null)}
          sub={ind?.current?.revpar != null ? `RevPAR ${brl0(ind.current.revpar)}` : undefined}
          href={isGerente ? undefined : "/dashboard/indicadores"}
        />
        <Kpi
          icon={Star}
          label="Avaliação dos hóspedes"
          value={d.reviews?.average != null ? `${score(d.reviews.average)} / 10` : "—"}
          sub={d.reviews ? `${d.reviews.total} avaliações · ${d.reviews.news} nova(s) na semana` : undefined}
          href="/dashboard/avaliacoes-hospedes"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Receita de hospedagem e taxa de ocupação (12 meses atrás e 5 à frente)" className="lg:col-span-2">
          {hasChart ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis xAxisId="a" dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <XAxis xAxisId="b" dataKey="label" hide />
                  <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `R$${Math.round(v)}`} />
                  <YAxis yAxisId="occ" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={34} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => (name === "Ocupação" ? [`${value}%`, name] : [brl(Number(value)), name])}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar xAxisId="a" yAxisId="rev" dataKey="revenue" name="Receita de hospedagem" fill={C_REVENUE} barSize={24} radius={[4, 4, 0, 0]}>
                    {chartData.map((p) => (
                      <Cell key={p.month} fill={p.isCurrent ? C_CURRENT : C_REVENUE} />
                    ))}
                  </Bar>
                  <Bar xAxisId="b" yAxisId="rev" dataKey="profit" name="Lucro gerencial" fill={C_PROFIT} barSize={10} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="occ" dataKey="occPct" name="Ocupação" stroke={C_OCC} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                  <Line yAxisId="price" dataKey="adr" name="ADR (STR)" stroke={C_ADR} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                  <Line yAxisId="price" dataKey="revpar" name="RevPAR (STR)" stroke={C_REVPAR} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem dados de indicadores ainda.</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Barra mais larga: receita de hospedagem (o mês corrente em dourado). Barra estreita por cima: lucro gerencial (disponível desde nov/2026).
          </p>
        </Panel>

        <Panel title="Avaliações dos hóspedes (notas de 0 a 10)">
          {d.reviews ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Média geral</span>
                <span className="text-base font-bold tabular-nums">{score(d.reviews.average)} / 10</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Média dos últimos 90 dias</span>
                <span className="text-base font-bold tabular-nums">{score(d.reviews.last90)} / 10</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Novas na última semana</span>
                <span className="text-base font-bold tabular-nums">{d.reviews.news}</span>
              </div>
              {d.reviews.booking && (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">Booking · média geral</span>
                    <span className="text-base font-bold tabular-nums">{score(d.reviews.booking.average)} / 10</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{d.reviews.booking.count} avaliações</p>
                  <ul className="space-y-1">
                    {d.reviews.booking.items.map((i) => (
                      <li key={i.label} className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-muted-foreground">{i.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{score(i.average)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <Link href="/dashboard/avaliacoes" className="text-primary hover:underline">
                  Ler e responder
                </Link>
                <Link href="/dashboard/avaliacoes-medias" className="text-primary hover:underline">
                  Médias
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Avaliações indisponíveis no momento.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <CentersPanel title={`Receita e despesa por centro · ${monthLabel}`} rows={d.centersCurrent} />
        <CentersPanel
          title={`Receita e despesa por centro · acumulado de ${sinceLabel} a ${monthLabel}`}
          rows={d.centersAccum}
          note={`Soma dos últimos ${d.windowMonths} mês(es), a partir de ${sinceLabel} (máximo de 12).`}
        />

        <Panel title="Maiores despesas · mês corrente e média">
          {d.expenseRanking.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma despesa lançada.</p>
          ) : (
            <div className="space-y-2.5">
              {d.expenseRanking.map((e, i) => (
                <div key={e.name} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{i + 1}.</span> {e.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{brl0(e.current)}</span> · média {brl0(e.average)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-[var(--chart-1)] dark:bg-[#B08968]" style={{ width: `${(e.current / maxExpense) * 100}%` }} />
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-muted-foreground/50" style={{ width: `${(e.average / maxExpense) * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Barra de cima: {monthLabel} · barra de baixo: média mensal dos {d.windowMonths} mês(es) desde {sinceLabel} (inclui o mês corrente). Ordem pelo maior dos dois valores.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function DashboardView({
  operational,
  gerencial,
  isGerente,
}: {
  operational: OperationalDashboard;
  gerencial: GerencialDashboard;
  isGerente: boolean;
}) {
  return (
    <Tabs defaultValue="operacional">
      <TabsList>
        <TabsTrigger value="operacional">Operacional</TabsTrigger>
        <TabsTrigger value="gerencial">Gerencial</TabsTrigger>
      </TabsList>
      <TabsContent value="operacional" className="pt-3">
        <OperationalView d={operational} />
      </TabsContent>
      <TabsContent value="gerencial" className="pt-3">
        <GerencialView d={gerencial} isGerente={isGerente} />
      </TabsContent>
    </Tabs>
  );
}

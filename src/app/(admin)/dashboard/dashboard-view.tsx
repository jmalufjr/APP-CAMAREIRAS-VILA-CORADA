"use client";

import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
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
import type { ConsumptionBlock, GerencialDashboard, MonthlyRankedItem, OperationalDashboard, RankedItem } from "@/lib/dashboard-data";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);

// Valor em destaque: bordô no tema claro, dourado nos escuros (mesma regra dos cards do app).
const VALUE_COLOR = "text-primary dark:text-[#E8B85C]";

type Accent = "amber" | "blue" | "emerald" | "rose" | "violet" | "teal" | "orange" | "sky";

// Cartões com fundo sólido e só as cores da identidade visual da pousada (bordô no tema claro, dourado nos escuros).
const ACCENTS: Record<Accent, { card: string; chip: string; dot: string }> = {
  amber: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
  blue: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
  emerald: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
  rose: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
  violet: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
  teal: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
  orange: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
  sky: { card: "bg-card", chip: "bg-primary/15 text-primary dark:bg-[#E8B85C]/20 dark:text-[#E8B85C]", dot: "bg-primary dark:bg-[#E8B85C]" },
};

// Efeito de botão em relevo: sombra com "degrau" embaixo; ao passar o mouse sobe, ao clicar afunda.
const RAISED = "shadow-[0_4px_0_0_#B08944,0_10px_18px_-6px_rgb(0_0_0/0.35)] transition-all duration-150";
const RAISED_LINK =
  "group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_0_0_#B08944,0_14px_22px_-6px_rgb(0_0_0/0.4)] group-active:translate-y-[3px] group-active:shadow-[0_1px_0_0_#B08944,0_2px_6px_-2px_rgb(0_0_0/0.3)]";

// Cartão inteiro clicável (quando tem href): leva à tela que amplia a informação do cartão.
function Shell({ href, accent = "blue", className, fill, children }: { href?: string; accent?: Accent; className?: string; fill?: boolean; children: React.ReactNode }) {
  const a = ACCENTS[accent];
  const card = (
    <Card size="sm" className={`${RAISED} ${a.card} ${fill ? "h-full" : ""} ${href ? RAISED_LINK : ""} ${href ? "" : (className ?? "")}`}>
      {children}
    </Card>
  );
  return href ? (
    <Link href={href} className={`group block ${fill ? "h-full flex-1" : ""} rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}>
      {card}
    </Link>
  ) : (
    card
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  href,
  tone,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: "alert";
  accent?: Accent;
}) {
  const a = ACCENTS[accent ?? "blue"];
  return (
    <Shell href={href} accent={accent} fill>
      <CardContent className="space-y-1.5">
        <div className="flex items-start gap-2 text-base font-medium text-foreground/80">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${a.chip}`}>
            <Icon size={16} strokeWidth={2} />
          </span>
          <span className="min-w-0 pt-0.5 leading-tight">{label}</span>
        </div>
        <p className={`text-3xl font-bold leading-none ${tone === "alert" ? "text-red-600 dark:text-red-400" : VALUE_COLOR}`}>{value}</p>
        {sub && <p className="text-sm leading-tight text-muted-foreground">{sub}</p>}
      </CardContent>
    </Shell>
  );
}

function Panel({
  title,
  children,
  className,
  href,
  accent,
  fill,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  large?: boolean;
  href?: string;
  accent?: Accent;
  fill?: boolean;
}) {
  const a = ACCENTS[accent ?? "blue"];
  return (
    <Shell href={href} accent={accent} className={className} fill={fill}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-[17px] group-data-[size=sm]/card:text-[17px]">
          <span className={`size-2.5 shrink-0 rounded-full ${a.dot}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Shell>
  );
}

const PIE_COLORS = ["#E8B85C", "#2563EB", "#059669", "#DB2777", "#7C3AED"];

function monthName(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

// Cinco mais consumidos do mês corrente: uma barra para o mês corrente e outra (mais clara) para o anterior.
function MonthlyRankList({ title, items, current, previous, accent }: { title: string; items: MonthlyRankedItem[]; current: string; previous: string; accent: Accent }) {
  const max = Math.max(1, ...items.flatMap((i) => [i.current, i.previous]));
  return (
    <Panel fill title={title} href="/frigobar" accent={accent}>
      {items.length === 0 ? (
        <p className="text-base text-muted-foreground">Sem consumo registrado em {monthName(current)}.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((i, idx) => (
            <div key={i.name} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-2 text-base">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{idx + 1}.</span> {i.name}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{i.current}</span> · ant. {i.previous}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-[var(--chart-1)] dark:bg-[#E8B85C]" style={{ width: `${(i.current / max) * 100}%` }} />
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-muted-foreground/50" style={{ width: `${(i.previous / max) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            Barra de cima: {monthName(current)} · barra de baixo: {monthName(previous)}.
          </p>
        </div>
      )}
    </Panel>
  );
}

// Pizza dos cinco itens mais consumidos desde o início; as fatias somam 100% entre os cinco.
function TopPie({ title, items, accent }: { title: string; items: RankedItem[]; accent: Accent }) {
  const total = items.reduce((s, i) => s + i.quantity, 0);
  const data = items.map((i) => ({ ...i, pct: total > 0 ? (i.quantity / total) * 100 : 0 }));
  return (
    <Panel fill title={title} href="/frigobar" accent={accent}>
      {total === 0 ? (
        <p className="text-base text-muted-foreground">Sem consumo registrado.</p>
      ) : (
        <div className="space-y-2">
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="quantity" nameKey="name" innerRadius={28} outerRadius={60} paddingAngle={1} stroke="var(--card)">
                  {data.map((d, i) => (
                    <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                  formatter={(value, name) => [`${value} un.`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-0.5 text-base">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{d.pct.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function SuiteChips({ rooms, empty }: { rooms: string[]; empty: string }) {
  if (rooms.length === 0) return <p className="text-base text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {rooms.map((n) => (
        <span key={n} className="rounded-md border border-border px-1.5 py-0.5 text-base font-medium">
          {n}
        </span>
      ))}
    </div>
  );
}

function CONSUMPTION_GROUPS(d: OperationalDashboard): [string, ConsumptionBlock, Accent][] {
  return [
    ["Frigobar", d.top.frigobar, "sky"],
    ["Bar · Petiscos", d.top.petiscos, "orange"],
    ["Bar · Drinks", d.top.drinks, "violet"],
    ["Bar · Outras bebidas", d.top.bebidas, "teal"],
  ];
}

function OperationalView({ d }: { d: OperationalDashboard }) {
  const bk = d.breakfast;
  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3">
        <Panel fill title="Suítes de hoje" href="/dashboard/servicos-suites" accent="amber">
          {d.todaySuites.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhuma suíte planejada para hoje.</p>
          ) : (
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
              {d.todaySuites.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b border-border py-1 text-base last:border-0">
                  <span className="min-w-0">
                    Suíte {t.room} · {t.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-sm font-medium ${
                      t.done ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-2 inline-block text-base text-primary hover:underline">
            Ver todos os serviços
          </span>
        </Panel>
        </div>
        <div className="flex flex-col gap-3">
        <Panel title="Chegadas e saídas de hoje" href="/chegadas-saidas/gerenciar" accent="blue">
          <div className="space-y-3 text-base">
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <CalendarClock size={13} /> Chegadas ({d.arrivals.length})
              </p>
              {d.arrivals.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma chegada prevista.</p>
              ) : (
                <ul className="space-y-0.5">
                  {d.arrivals.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">
                        Suíte {a.room} · {a.firstName}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{a.time ?? "sem horário"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Saídas ({d.departures.length})</p>
              {d.departures.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma saída prevista.</p>
              ) : (
                <ul className="space-y-0.5">
                  {d.departures.map((x) => (
                    <li key={x.id} className="truncate">
                      Suíte {x.room} · {x.firstName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="inline-block text-primary hover:underline">
              Abrir Chegadas &amp; saídas
            </span>
          </div>
        </Panel>
        <Panel fill title="Contas de consumo" href="/frigobar" accent="violet">
          <ul className="divide-y divide-border">
            {(
              [
                ["Contas em aberto", d.accounts.open, brl(d.accounts.total), false],
                ["Contas com checkout em aberto", d.accounts.checkoutOpen.count, `${brl(d.accounts.checkoutOpen.total)} · hóspede já saiu`, d.accounts.checkoutOpen.count > 0],
                ["Contas com checkout fechadas, não pagas", d.accounts.checkoutClosed.count, `${brl(d.accounts.checkoutClosed.total)} · aguardando pagamento`, false],
              ] as const
            ).map(([label, count, sub, alert]) => (
              <li key={label} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block text-base">{label}</span>
                  <span className="block text-sm text-muted-foreground">{sub}</span>
                </span>
                <span className={`shrink-0 text-right text-xl font-bold ${alert ? "text-red-600 dark:text-red-400" : VALUE_COLOR}`}>{count}</span>
              </li>
            ))}
          </ul>
        </Panel>
        </div>
        <div className="flex flex-col gap-3">
        <Panel title="Mesas do café da manhã" href="/mesas/gerenciar" accent="orange">
          <div className="space-y-3 text-base">
            {(
              [
                ["Hoje", bk.today],
                ["Amanhã", bk.tomorrow],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <Coffee size={13} /> {label}
                </span>
                <span className="text-right tabular-nums">
                  <span className="text-xl font-bold">{v.tables}</span> mesas · <span className="text-xl font-bold">{v.guests}</span> hóspedes
                </span>
              </div>
            ))}
            <span className="inline-block text-primary hover:underline">
              Abrir Mesas do café
            </span>
          </div>
        </Panel>
        <Panel title="Suítes vagas, disponíveis para alugar" href="/dashboard/suites-disponiveis" accent="emerald">
          <div className="space-y-3">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-base font-medium">
                <Key size={13} /> Limpas ({d.suites.clean.length})
              </p>
              <SuiteChips rooms={d.suites.clean} empty="Nenhuma suíte limpa e vaga." />
            </div>
            <div>
              <p className="mb-1 text-base font-medium text-muted-foreground">Sujas ({d.suites.dirty.length})</p>
              <SuiteChips rooms={d.suites.dirty} empty="Nenhuma suíte suja e vaga." />
            </div>
            <span className="text-base text-primary hover:underline">
              Ver detalhes
            </span>
          </div>
        </Panel>
        <Panel fill title="Manutenção" href="/ocorrencias" accent="rose">
          <div className="space-y-2 text-base">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Ocorrências hoje</span>
              <span className="text-xl font-bold tabular-nums">{d.occurrences.today}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Em aberto (pendentes ou selecionadas)</span>
              <span className="text-xl font-bold tabular-nums">{d.occurrences.open}</span>
            </div>
            <div className="flex gap-3 pt-1">
              <span className="text-primary hover:underline">
                Ver ocorrências
              </span>
              <span className="text-primary hover:underline">
                Manutenção preventiva
              </span>
            </div>
          </div>
        </Panel>
        </div>
      </div>

      <div>
        <p className="mb-2 text-base font-medium text-muted-foreground">
          Mais consumidos no mês corrente ({monthName(d.monthLabels.current)}), com o mês anterior ao lado
        </p>
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONSUMPTION_GROUPS(d).map(([title, block, accent]) => (
            <MonthlyRankList key={title} title={title} items={block.monthly} current={d.monthLabels.current} previous={d.monthLabels.previous} accent={accent} />
          ))}
          {CONSUMPTION_GROUPS(d).map(([title, block, accent]) => (
            <TopPie key={title} title={`${title} · desde o início`} items={block.pie} accent={accent} />
          ))}
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
const C_OCC = "#FDE047";
const C_ADR = "#7C3AED";
const C_REVPAR = "#DB2777";

function CentersPanel({ title, rows, note, accent }: { title: string; rows: GerencialDashboard["centersCurrent"]; note?: string; accent: Accent }) {
  const max = Math.max(1, ...rows.flatMap((c) => [c.revenue, c.expenses]));
  return (
    <Panel fill title={title} href="/contabil/resultado-mensal" accent={accent}>
      {rows.length === 0 ? (
        <p className="text-base text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((c) => (
            <div key={c.center} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-base">
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
          <p className="text-sm text-muted-foreground">Barra de cima: receita · barra de baixo: despesa.{note ? ` ${note}` : ""}</p>
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
          accent="emerald" label="Lucro gerencial do mês"
          value={r ? brl0(r.operating) : "—"}
          sub={`${monthLabel} · parcial`}
          href="/contabil/resultado-mensal"
          tone={r && r.operating < 0 ? "alert" : undefined}
        />
        <Kpi icon={TrendingUp} accent="blue" label="Receita do mês" value={r ? brl0(r.revenue) : "—"} sub="hospedagem líquida + bar + frigobar" href="/contabil/resultado-mensal" />
        <Kpi icon={CreditCard} accent="rose" label="Despesas do mês" value={r ? brl0(r.expenses) : "—"} sub="regime caixa, rateadas" href="/contabil/compras/relatorio" />
        <Kpi
          icon={BedDouble}
          accent="violet" label="Diária média (ADR)"
          value={ind?.current?.adr != null ? brl0(ind.current.adr) : "—"}
          sub={`${ind?.current?.paid ?? 0} diárias vendidas`}
          href={isGerente ? undefined : "/dashboard/indicadores"}
        />
        <Kpi
          icon={Percent}
          accent="sky" label="Ocupação comercial"
          value={pct(ind?.current?.occ ?? null)}
          sub={ind?.current?.revpar != null ? `RevPAR ${brl0(ind.current.revpar)}` : undefined}
          href={isGerente ? undefined : "/dashboard/indicadores"}
        />
        <Kpi
          icon={Star}
          accent="amber" label="Avaliação dos hóspedes"
          value={d.reviews?.average != null ? `${score(d.reviews.average)} / 10` : "—"}
          sub={d.reviews ? `${d.reviews.total} avaliações · ${d.reviews.news} nova(s) na semana` : undefined}
          href="/dashboard/avaliacoes-hospedes"
        />
      </div>

      <div>
        <Panel title="Receita de hospedagem, lucro gerencial, taxa de ocupação, ADR e RevPAR (12 meses atrás e 5 à frente)" large href={isGerente ? undefined : "/dashboard/indicadores"} accent="blue">
          {hasChart ? (
            <div className="h-[26rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis xAxisId="a" dataKey="label" tick={{ fontSize: 14, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <XAxis xAxisId="b" dataKey="label" hide />
                  <YAxis yAxisId="rev" tick={{ fontSize: 14, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 14, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `R$${Math.round(v)}`} />
                  <YAxis yAxisId="occ" orientation="right" domain={[0, 100]} tick={{ fontSize: 14, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                    formatter={(value, name) => (name === "Ocupação" ? [`${value}%`, name] : [brl(Number(value)), name])}
                  />
                  <Legend wrapperStyle={{ fontSize: 15 }} />
                  <Bar xAxisId="a" yAxisId="rev" dataKey="revenue" name="Receita de hospedagem" fill={C_REVENUE} barSize={30} radius={[4, 4, 0, 0]}>
                    {chartData.map((p) => (
                      <Cell key={p.month} fill={p.isCurrent ? C_CURRENT : C_REVENUE} />
                    ))}
                  </Bar>
                  <Bar xAxisId="b" yAxisId="rev" dataKey="profit" name="Lucro gerencial" fill={C_PROFIT} barSize={13} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="occ" dataKey="occPct" name="Ocupação" stroke={C_OCC} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line yAxisId="price" dataKey="adr" name="ADR (STR)" stroke={C_ADR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line yAxisId="price" dataKey="revpar" name="RevPAR (STR)" stroke={C_REVPAR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-base text-muted-foreground">Sem dados de indicadores ainda.</p>
          )}
          <p className="mt-2 text-base text-muted-foreground">
            Barra mais larga: receita de hospedagem (o mês corrente em dourado). Barra estreita por cima: lucro gerencial (disponível desde nov/2026).
          </p>
        </Panel>

      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <Panel fill title="Avaliações dos hóspedes (notas de 0 a 10)" href="/dashboard/avaliacoes-hospedes" accent="amber">
          {d.reviews ? (
            <div className="space-y-2 text-base">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Média geral</span>
                <span className="text-xl font-bold tabular-nums">{score(d.reviews.average)} / 10</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Média dos últimos 90 dias</span>
                <span className="text-xl font-bold tabular-nums">{score(d.reviews.last90)} / 10</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Novas na última semana</span>
                <span className="text-xl font-bold tabular-nums">{d.reviews.news}</span>
              </div>
              {d.reviews.booking && (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">Booking · média geral</span>
                    <span className="text-xl font-bold tabular-nums">{score(d.reviews.booking.average)} / 10</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{d.reviews.booking.count} avaliações</p>
                  <ul className="space-y-1">
                    {d.reviews.booking.items.map((i) => (
                      <li key={i.label} className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-muted-foreground">{i.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{score(i.average)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="pt-1 font-medium">Booking · média por suíte</p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {d.reviews.booking.bySuite.map((b) => (
                      <li key={b.suite} className="flex items-baseline justify-between gap-2">
                        <span className="text-muted-foreground">
                          Suíte {b.suite} <span className="text-sm">({b.count})</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{score(b.average)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <span className="text-primary hover:underline">
                  Ler e responder
                </span>
                <span className="text-primary hover:underline">
                  Médias
                </span>
              </div>
            </div>
          ) : (
            <p className="text-base text-muted-foreground">Avaliações indisponíveis no momento.</p>
          )}
        </Panel>
        <div className="flex flex-col gap-3">
        <CentersPanel title={`Receita e despesa por centro · ${monthLabel}`} rows={d.centersCurrent} accent="emerald" />
        <CentersPanel
          title={`Receita e despesa por centro · acumulado de ${sinceLabel} a ${monthLabel}`}
          rows={d.centersAccum}
          accent="teal"
          note={`Soma dos últimos ${d.windowMonths} mês(es), a partir de ${sinceLabel} (máximo de 12).`}
        />
        </div>
      </div>

        <Panel title="Maiores despesas · mês corrente e média" href="/contabil/compras/relatorio" accent="rose">
          {d.expenseRanking.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhuma despesa lançada.</p>
          ) : (
            <div className="space-y-4">
              {d.expenseRanking.map((e, i) => (
                <div key={e.name} className="space-y-1.5">
                  <p className="text-base">
                    <span className="text-muted-foreground">{i + 1}.</span> {e.name}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-3.5 flex-1 rounded-full bg-muted">
                      <div className="h-3.5 rounded-full bg-[var(--chart-1)] dark:bg-[#E8B85C]" style={{ width: `${(e.current / maxExpense) * 100}%` }} />
                    </div>
                    <span className="w-40 shrink-0 text-right text-base font-semibold tabular-nums">{brl0(e.current)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3.5 flex-1 rounded-full bg-muted">
                      <div className="h-3.5 rounded-full bg-muted-foreground/50" style={{ width: `${(e.average / maxExpense) * 100}%` }} />
                    </div>
                    <span className="w-40 shrink-0 text-right text-base tabular-nums text-muted-foreground">média {brl0(e.average)}</span>
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Barra de cima: {monthLabel} · barra de baixo: média mensal dos {d.windowMonths} mês(es) desde {sinceLabel} (inclui o mês corrente). Ordem pelo maior dos dois valores.
              </p>
            </div>
          )}
        </Panel>
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

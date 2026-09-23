import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, formatDatePt, nowInBrazil } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getBarCommissionByCamareira } from "@/lib/actions/comandas";
import { getBreakfastCommissionPotForRange } from "@/lib/actions/breakfast-commission";
import { SyncStaysAllButton } from "./sync-stays-all-button";
import {
  BedDouble,
  Coffee,
  AlertTriangle,
  Wallet,
  Martini,
  Wine,
  Percent,
  History,
  ChevronRight,
  Key,
  Mail,
  KeyRound,
} from "lucide-react";

function monthRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const menuItems = [
  { href: "/dashboard/servicos-suites", label: "Serviços nas suítes", icon: BedDouble },
  {
    href: "/dashboard/suites-disponiveis",
    label: "Suítes vagas e limpas, disponíveis para alugar",
    icon: Key,
  },
  { href: "/dashboard/consumo-frigobar", label: "Consumo de frigobar", icon: Wine },
  { href: "/dashboard/consumo-bar", label: "Consumo de bar", icon: Martini },
  { href: "/dashboard/comissoes", label: "Comissões das camareiras", icon: Percent },
  { href: "/dashboard/email-envio", label: "Cadastrar e-mail de envio", icon: Mail },
  { href: "/dashboard/api-tokens", label: "Chaves de acesso — API de consumos", icon: KeyRound },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayKey();
  const { start, end } = monthRange();

  const [
    { data: todayTasks },
    { data: todayEligibility },
    { data: todayAssignmentsFallback },
    { count: occurrencesToday },
    barCommission,
    totalCommissionMonth,
  ] = await Promise.all([
    supabase.from("daily_room_tasks").select("status").eq("date", today),
    // Suítes elegíveis pro café da manhã hoje (independente de terem sido
    // de fato alocadas a uma mesa) — só usada aqui pro card "Suítes no
    // café hoje"; o total em R$ do mês vem de
    // getBreakfastCommissionPotForRange, que aplica a mesma regra (com o
    // mesmo fallback) já compartilhada com o Histórico.
    supabase.from("daily_breakfast_settings").select("eligible_suites_count").eq("date", today).maybeSingle(),
    // Fallback pra hoje sem eligible_suites_count (regra antiga: conta
    // suítes alocadas a alguma mesa) — uma mudança de regra não pode
    // zerar retroativamente um valor que já tinha sido calculado.
    supabase.from("daily_breakfast_room_assignments").select("room_id").eq("date", today),
    supabase
      .from("daily_room_task_occurrences")
      .select("id, daily_room_tasks!inner(date)", { count: "exact", head: true })
      .eq("daily_room_tasks.date", today),
    getBarCommissionByCamareira(),
    getBreakfastCommissionPotForRange(start, end),
  ]);

  const doneToday = (todayTasks ?? []).filter((t) => t.status === "concluido").length;
  const totalToday = (todayTasks ?? []).length;

  const suitesToday = todayEligibility?.eligible_suites_count ?? (todayAssignmentsFallback ?? []).length;

  const barCommissionCurrentMonthTotal = barCommission.currentMonth.reduce((sum, r) => sum + r.commission, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resumo executivo"
        subtitle={`Resumo de hoje, ${formatDatePt(today)}`}
        action={<ThemeToggle />}
      />

      <div className="space-y-3">
        <p className="font-heading text-lg">Consulta rápida do mês corrente</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={BedDouble} label="Suítes concluídas hoje" value={`${doneToday} / ${totalToday}`} />
          <StatCard icon={Coffee} label="Suítes no café hoje" value={String(suitesToday)} />
          <StatCard icon={Wallet} label="Comissão Suítes e Café" value={`R$ ${totalCommissionMonth.toFixed(2)}`} />
          <StatCard icon={Percent} label="Comissão Bar" value={`R$ ${barCommissionCurrentMonthTotal.toFixed(2)}`} />
          <StatCard
            icon={AlertTriangle}
            label="Ocorrências Manutenção hoje"
            value={String(occurrencesToday ?? 0)}
            footer={
              <div className="flex flex-col gap-0.5 pt-0.5">
                <Link href="/ocorrencias" className="text-xs text-primary hover:underline w-fit">
                  Ver detalhes
                </Link>
                <Link
                  href="/ocorrencias/historico"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 w-fit"
                >
                  <History size={11} /> Histórico
                </Link>
              </div>
            }
          />
        </div>
      </div>

      <SyncStaysAllButton />

      <nav className="max-w-md space-y-1.5">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <item.icon size={18} strokeWidth={1.75} className="text-muted-foreground" />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>
        ))}
      </nav>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  footer,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  // Conteúdo extra opcional abaixo do valor (ex.: os links "Ver
  // detalhes"/"Histórico" do card de ocorrências).
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-1.5">
        {/* items-start (não items-center): o ícone fica sempre alinhado ao
            topo do título, na mesma posição em todos os cards — com
            items-center, um título mais longo que quebra em 2-3 linhas
            (ex.: "Ocorrências Manutenção hoje") empurrava o ícone mais pra
            baixo que o dos outros cards, desalinhando os círculos entre si. */}
        <div className="flex items-start gap-2">
          <div className="size-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
            <Icon size={16} strokeWidth={1.75} />
          </div>
          {/* min-w-0 é o que permite o título quebrar linha dentro do card
              em vez de estourar a borda (sem isso, um item flex não encolhe
              abaixo do tamanho do próprio conteúdo). */}
          <p className="min-w-0 flex-1 text-sm font-semibold leading-tight">{label}</p>
        </div>
        {/* Valor menor que o título, mas destacado por cor — bordô (cor da
            marca) no tema claro, dourado nos dois temas escuros (onde a cor
            "primary" do tema já é quase branca, igual ao resto do texto, e
            não serviria de destaque sozinha) — e centralizado no card. */}
        <p className="text-center text-base font-bold text-primary dark:text-[#E8B85C]">{value}</p>
        {footer}
      </CardContent>
    </Card>
  );
}

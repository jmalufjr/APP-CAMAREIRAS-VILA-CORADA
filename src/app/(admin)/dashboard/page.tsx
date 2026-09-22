import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, formatDatePt, nowInBrazil } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getBarCommissionByCamareira } from "@/lib/actions/comandas";
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
  { href: "/dashboard/comissao-bar", label: "Comissão de 10% do bar por camareira", icon: Percent },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayKey();
  const { start, end } = monthRange();

  const [{ data: todayTasks }, { data: monthEligibility }, { data: monthAssignmentsFallback }, { data: commissionSettings }, { count: occurrencesToday }, barCommission] =
    await Promise.all([
      supabase.from("daily_room_tasks").select("status").eq("date", today),
      // Comissão do dia = quantidade de suítes elegíveis pro café da manhã
      // naquele dia (independente de terem sido de fato alocadas a uma
      // mesa) × valor por café servido — gravada a cada sincronização com a
      // Stays em daily_breakfast_settings. eligible_suites_count é nulo pra
      // datas anteriores a essa coluna existir; ver fallback abaixo.
      supabase
        .from("daily_breakfast_settings")
        .select("date, eligible_suites_count")
        .gte("date", start)
        .lte("date", end),
      // Fallback pra datas sem eligible_suites_count (regra antiga: conta
      // suítes alocadas a alguma mesa) — uma mudança de regra não pode
      // zerar retroativamente um valor que já tinha sido calculado.
      supabase.from("daily_breakfast_room_assignments").select("date, room_id").gte("date", start).lte("date", end),
      supabase.from("commission_settings").select("value_per_table").single(),
      supabase
        .from("daily_room_task_occurrences")
        .select("id, daily_room_tasks!inner(date)", { count: "exact", head: true })
        .eq("daily_room_tasks.date", today),
      getBarCommissionByCamareira(),
    ]);

  const doneToday = (todayTasks ?? []).filter((t) => t.status === "concluido").length;
  const totalToday = (todayTasks ?? []).length;

  const commissionRate = Number(commissionSettings?.value_per_table ?? 0);

  // Regra antiga (suítes com alguma mesa naquele dia) só usada como
  // fallback pra data sem eligible_suites_count.
  const fallbackSuitesByDate = new Map<string, number>();
  (monthAssignmentsFallback ?? []).forEach((r) => {
    fallbackSuitesByDate.set(r.date, (fallbackSuitesByDate.get(r.date) ?? 0) + 1);
  });

  // eligible_suites_count nulo (ou a data nem aparecer aqui) = nunca
  // sincronizada sob essa regra — cai pro fallback em vez de zerar um
  // valor que já existia (nunca uma mudança de regra pode zerar
  // retroativamente algo que já tinha sido calculado).
  const eligibilityByDate = new Map<string, number | null>(
    (monthEligibility ?? []).map((r) => [r.date, r.eligible_suites_count])
  );
  const allDates = new Set<string>([...eligibilityByDate.keys(), ...fallbackSuitesByDate.keys()]);
  const suitesByDate = new Map<string, number>();
  allDates.forEach((date) => {
    suitesByDate.set(date, eligibilityByDate.get(date) ?? fallbackSuitesByDate.get(date) ?? 0);
  });

  const totalSuitesMonth = Array.from(suitesByDate.values()).reduce((sum, n) => sum + n, 0);
  const totalCommissionMonth = totalSuitesMonth * commissionRate;
  const suitesToday = suitesByDate.get(today) ?? 0;

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
          <StatCard icon={Wallet} label="Comissão do mês" value={`R$ ${totalCommissionMonth.toFixed(2)}`} />
          <StatCard icon={Percent} label="10% bar total" value={`R$ ${barCommissionCurrentMonthTotal.toFixed(2)}`} />
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

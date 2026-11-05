import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/actions/session";
import { PageHeader } from "@/components/shared/page-header";
import { todayKey, formatDatePt } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getItemsNeedingPurchaseCount } from "@/lib/actions/purchase-list";
import {
  BedDouble,
  AlertTriangle,
  Martini,
  Wine,
  History,
  ChevronRight,
  Key,
  CalendarRange,
  CircleDollarSign,
  Star,
  TrendingUp,
} from "lucide-react";

const menuItems = [
  { href: "/dashboard/calendario-stays", label: "Calendário de reservas - Stays", icon: CalendarRange },
  { href: "/dashboard/ticket-medio-canais", label: "Ticket médio de canais de venda", icon: CircleDollarSign },
  { href: "/dashboard/avaliacoes-hospedes", label: "Avaliações dos hóspedes", icon: Star },
  { href: "/dashboard/indicadores", label: "Indicadores", icon: TrendingUp },
  { href: "/dashboard/servicos-suites", label: "Serviços nas suítes", icon: BedDouble },
  {
    href: "/dashboard/suites-disponiveis",
    label: "Suítes vagas e limpas, disponíveis para alugar",
    icon: Key,
  },
  { href: "/dashboard/consumo-frigobar", label: "Consumo de frigobar", icon: Wine },
  { href: "/dashboard/consumo-bar", label: "Consumo de bar", icon: Martini },
];

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "gerente_operacional") {
    const gerenteItems = menuItems.filter((i) => i.href === "/dashboard/servicos-suites" || i.href === "/dashboard/suites-disponiveis" || i.href === "/dashboard/calendario-stays" || i.href === "/dashboard/avaliacoes-hospedes");
    return (
      <div className="space-y-6">
        <PageHeader title="Resumo executivo" subtitle={`Resumo de hoje, ${formatDatePt(todayKey())}`} />
        <nav className="max-w-md space-y-1.5">
          {gerenteItems.map((item) => (
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
  const supabase = await createClient();
  const today = todayKey();

  const [{ data: todayTasks }, { count: occurrencesToday }, itemsNeedingPurchaseCount] = await Promise.all([
    supabase.from("daily_room_tasks").select("status").eq("date", today),
    supabase
      .from("daily_room_task_occurrences")
      .select("id, daily_room_tasks!inner(date)", { count: "exact", head: true })
      .eq("daily_room_tasks.date", today),
    getItemsNeedingPurchaseCount(),
  ]);

  const doneToday = (todayTasks ?? []).filter((t) => t.status === "concluido").length;
  const totalToday = (todayTasks ?? []).length;

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

      {itemsNeedingPurchaseCount > 0 && (
        <Link
          href="/compras/lista"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive hover:bg-destructive/15 transition-colors w-fit"
        >
          <AlertTriangle size={16} />
          {itemsNeedingPurchaseCount} item(ns) precisam de compra
          <ChevronRight size={14} />
        </Link>
      )}

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

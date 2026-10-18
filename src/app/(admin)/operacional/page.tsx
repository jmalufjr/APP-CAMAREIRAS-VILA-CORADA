import Link from "next/link";
import { getCurrentProfile } from "@/lib/actions/session";
import { PageHeader } from "@/components/shared/page-header";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarClock,
  Coffee,
  Wine,
  Percent,
  ClipboardList,
  CalendarCheck2,
  History,
  ChevronRight,
} from "lucide-react";

const menuItems = [
  { href: "/dashboard", label: "Resumo operacional", icon: LayoutDashboard },
  { href: "/planejamento", label: "Planejamento diário", icon: ClipboardCheck },
  { href: "/chegadas-saidas/gerenciar", label: "Chegadas & saídas", icon: CalendarClock },
  { href: "/mesas/gerenciar", label: "Mesas do café", icon: Coffee },
  { href: "/frigobar", label: "Consumo de Bar e Frigobar", icon: Wine },
  { href: "/operacional/comissoes", label: "Comissões das camareiras", icon: Percent },
  { href: "/checklists", label: "Listas operacionais", icon: ClipboardList },
  { href: "/manutencao-preventiva", label: "Manutenção Preventiva", icon: CalendarCheck2 },
  { href: "/historico", label: "Histórico", icon: History },
];

// Itens que o gerente operacional enxerga (o resto é do admin).
const GERENTE_HREFS = new Set([
  "/dashboard",
  "/planejamento",
  "/chegadas-saidas/gerenciar",
  "/mesas/gerenciar",
  "/frigobar",
  "/operacional/comissoes",
]);

export default async function ModuloOperacionalPage() {
  const profile = await getCurrentProfile();
  const items = profile.role === "gerente_operacional" ? menuItems.filter((i) => GERENTE_HREFS.has(i.href)) : menuItems;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulo operacional"
        subtitle="O dia a dia da pousada: planejamento, chegadas e saídas, café da manhã, consumos, listas, manutenção e histórico."
      />
      <nav className="max-w-md space-y-1.5">
        {items.map((item) => (
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

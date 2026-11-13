import { BackLink } from "@/components/shared/back-link";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentProfile } from "@/lib/actions/session";
import {
  ListChecks,
  Wrench,
  CalendarCheck2,
  BedDouble,
  Coffee,
  Wine,
  Martini,
  Package,
  ChevronRight,
} from "lucide-react";

const menuItems = [
  { href: "/checklists/servicos-suites", label: "Check lists de serviços nas suítes", icon: ListChecks },
  { href: "/checklists/ocorrencias", label: "Ocorrências Manutenção", icon: Wrench },
  { href: "/checklists/manutencao-preventiva", label: "Manutenção Preventiva", icon: CalendarCheck2 },
  { href: "/checklists/quartos", label: "Suítes", icon: BedDouble },
  { href: "/checklists/frigobar", label: "Cardápio de frigobar", icon: Wine },
  { href: "/checklists/poolbar", label: "Cardápio de bar da piscina", icon: Martini },
  { href: "/checklists/poolbar/ingredientes", label: "Ingredientes de bar da piscina", icon: Package },
  { href: "/checklists/mesas", label: "Layout & mesas", icon: Coffee },
];

// Ocorrências Manutenção e Manutenção Preventiva não aparecem para o gerente operacional.
const GERENTE_HIDDEN = new Set(["/checklists/ocorrencias", "/checklists/manutencao-preventiva"]);

export default async function ChecklistsPage() {
  const profile = await getCurrentProfile();
  const items = profile.role === "gerente_operacional" ? menuItems.filter((i) => !GERENTE_HIDDEN.has(i.href)) : menuItems;
  return (
    <div className="space-y-6">
      <BackLink href="/operacional" />
      <PageHeader title="Listas operacionais" subtitle="Escolha o que deseja gerenciar." />
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

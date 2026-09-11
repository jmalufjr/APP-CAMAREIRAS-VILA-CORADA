import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { TASK_TYPE_LABELS } from "@/lib/task-type";
import {
  Sparkles,
  RefreshCw,
  DoorOpen,
  Wrench,
  CalendarCheck2,
  BedDouble,
  Coffee,
  Wine,
  Martini,
  ChevronRight,
} from "lucide-react";

const menuItems = [
  { href: "/checklists/arrumacao", label: TASK_TYPE_LABELS.arrumacao, icon: Sparkles },
  { href: "/checklists/troca", label: TASK_TYPE_LABELS.troca, icon: RefreshCw },
  { href: "/checklists/preparacao", label: TASK_TYPE_LABELS.preparacao, icon: DoorOpen },
  { href: "/checklists/ocorrencias", label: "Ocorrências Manutenção", icon: Wrench },
  { href: "/checklists/manutencao-preventiva", label: "Manutenção Preventiva", icon: CalendarCheck2 },
  { href: "/checklists/quartos", label: "Quartos", icon: BedDouble },
  { href: "/checklists/frigobar", label: "Consumo de Frigobar", icon: Wine },
  { href: "/checklists/poolbar", label: "Bar da Piscina", icon: Martini },
  { href: "/checklists/mesas", label: "Layout & mesas", icon: Coffee },
];

export default function ChecklistsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Listas" subtitle="Escolha o que deseja gerenciar." />
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

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Plus, History, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/manutencao/compras/nova", label: "Lançar compra/despesa", icon: Plus },
  { href: "/manutencao/compras/historico", label: "Histórico de compras", icon: History },
];

export default function ManutencaoComprasPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Compras" subtitle="Registre uma compra feita pra pousada, com ou sem foto da nota." />
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

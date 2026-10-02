import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ClipboardList, Package, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/ativo-permanente/relacao", label: "Relação de Ativo Permanente", icon: ClipboardList },
  { href: "/ativo-permanente/itens", label: "Itens de ativo permanente", icon: Package },
];

export default function AtivoPermanentePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ativo Permanente"
        subtitle="Bens que não se consomem (TVs, móveis, equipamentos, veículos etc.) — separados do controle de estoque."
      />
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

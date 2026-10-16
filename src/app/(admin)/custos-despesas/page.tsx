import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Calculator, FileBarChart, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/custos-despesas/custos", label: "Custos", icon: Calculator },
  { href: "/custos-despesas/demonstrativo", label: "Demonstrativo de Despesas", icon: FileBarChart },
];

export default function CustosDespesasPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Custos e Despesas"
        subtitle="Custo da hospedagem, do café da manhã e dos pratos/produtos servidos, e o demonstrativo de todas as despesas por centro de custo. A categorização em si (Plano de Contas) é gerida em Listas."
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

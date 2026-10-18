import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { FileBarChart, Calculator, ListTree, Sigma, BookOpen, BookMarked, Landmark, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/contabil/demonstrativos/despesas", label: "Demonstrativo de despesas", icon: FileBarChart },
  { href: "/contabil/demonstrativos/custos", label: "Demonstrativo de Custos", icon: Calculator },
  { href: "/contabil/demonstrativos/balancete-analitico", label: "Balancete analítico", icon: ListTree },
  { href: "/contabil/demonstrativos/balancete-sintetico", label: "Balancete sintético", icon: Sigma },
  { href: "/contabil/demonstrativos/livro-diario", label: "Livro Diário", icon: BookOpen },
  { href: "/contabil/demonstrativos/livro-razao", label: "Livro Razão", icon: BookMarked },
  { href: "/contabil/demonstrativos/livro-caixa-bancos", label: "Livro caixa e bancos", icon: Landmark },
];

export default function DemonstrativosPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader title="Demonstrativos e Relatórios" subtitle="Custos, despesas, balancetes e os livros contábeis — tudo calculado a partir dos lançamentos automáticos." />
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

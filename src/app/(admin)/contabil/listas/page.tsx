import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Package, Receipt, FolderTree, Boxes, UtensilsCrossed, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/contabil/listas/produtos", label: "Cadastro de produtos", icon: Package },
  { href: "/contabil/listas/despesas", label: "Cadastro de despesas", icon: Receipt },
  { href: "/contabil/listas/plano-de-contas", label: "Plano de contas e centros de custo", icon: FolderTree },
  { href: "/contabil/listas/plano-ativo-permanente", label: "Plano de itens de ativo permanente", icon: Boxes },
  { href: "/contabil/listas/ficha-tecnica", label: "Ficha técnica de petiscos e drinks", icon: UtensilsCrossed },
];

export default function ListasContabeisPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader title="Listas contábeis" subtitle="Os cadastros que alimentam a contabilidade: produtos, despesas, plano de contas, ativo permanente e fichas técnicas." />
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

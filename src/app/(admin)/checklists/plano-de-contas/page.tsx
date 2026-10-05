import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { FolderTree, Package, ChevronRight } from "lucide-react";

const menuItems = [
  { href: "/checklists/plano-de-contas/custo", label: "Plano de itens de custo", icon: FolderTree },
  { href: "/checklists/plano-de-contas/ativo-permanente", label: "Plano de itens de ativo permanente", icon: Package },
];

export default function PlanoDeContasPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/checklists" />
      <PageHeader
        title="Plano de Contas"
        subtitle="Centro de custo → subcentro de custo → item de custo — a base de toda categorização de compras e despesas."
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

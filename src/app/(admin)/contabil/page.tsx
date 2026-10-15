import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BookOpen, FolderTree, ChevronRight } from "lucide-react";

// Módulo Contábil — Leva 1 (PRD_compras&contabil.md seção 22): por ora
// só o plano de contas contábil e o livro de lançamentos, a fundação do
// motor de partidas dobradas. As próximas levas vão trazer compras,
// vendas, estoque, pagamentos/recebimentos etc. pra dentro deste mesmo
// menu, reunindo tudo que hoje está espalhado (Compras, Custos e
// Despesas, Ativo Permanente) — ver o plano de levas combinado com o
// proprietário.
const menuItems = [
  { href: "/contabil/plano-de-contas", label: "Plano de contas", icon: FolderTree },
  { href: "/contabil/lancamentos", label: "Livro de lançamentos", icon: BookOpen },
];

export default function ModuloContabilPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulo Contábil"
        subtitle="Plano de contas e partidas dobradas — a base contábil por trás de compras, vendas e estoque. Em construção, leva a leva."
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

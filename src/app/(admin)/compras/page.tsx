import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { getLowStockItems } from "@/lib/actions/inventory-items";
import { Plus, History, Package, Tags, ClipboardList, PackageMinus, ChevronRight, AlertTriangle } from "lucide-react";

const menuItems = [
  { href: "/compras/nova", label: "Lançar compra/despesa", icon: Plus },
  { href: "/compras/baixa", label: "Baixa de estoque", icon: PackageMinus },
  { href: "/compras/historico", label: "Histórico de compras e despesas", icon: History },
  { href: "/compras/itens", label: "Itens de estoque", icon: Package },
  { href: "/compras/categorias", label: "Categorias de despesa", icon: Tags },
  { href: "/compras/contagem", label: "Contagem de estoque", icon: ClipboardList },
];

export default async function ComprasPage() {
  const lowStock = await getLowStockItems();

  return (
    <div className="space-y-6">
      <PageHeader title="Compras e Estoque" subtitle="Compras, despesas e controle de estoque da pousada." />

      {lowStock.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle size={16} /> {lowStock.length} item(ns) com estoque baixo
          </p>
          <ul className="text-sm text-destructive/90 space-y-0.5">
            {lowStock.map((i) => (
              <li key={i.id}>
                {i.name}: {i.balance} {i.unit} (ponto de reposição: {i.reorder_point} {i.unit})
              </li>
            ))}
          </ul>
        </div>
      )}

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

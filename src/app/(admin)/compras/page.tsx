import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { getPurchaseList } from "@/lib/actions/purchase-list";
import { getCategoryCountStatus } from "@/lib/actions/inventory-counts";
import { Package, Tags, ClipboardList, PackageMinus, ChevronRight, AlertTriangle, CalendarClock } from "lucide-react";

const menuItems = [
  { href: "/compras/baixa", label: "Baixa de estoque", icon: PackageMinus },
  { href: "/compras/itens", label: "Itens de estoque", icon: Package },
  { href: "/compras/categorias", label: "Categorias de despesa", icon: Tags },
  { href: "/compras/grupos-giro", label: "Grupos de giro (dias de folga)", icon: CalendarClock },
  { href: "/compras/contagem", label: "Contagem de estoque", icon: ClipboardList },
];

export default async function ComprasPage() {
  const [purchaseList, countStatuses] = await Promise.all([getPurchaseList(), getCategoryCountStatus()]);
  const dueCategories = countStatuses.filter((s) => s.is_due);

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" subtitle="Controle de estoque da pousada — itens, categorias e contagem física." />

      <div className="flex flex-wrap gap-2">
        {purchaseList.length > 0 && (
          <Link
            href="/compras/lista"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive hover:bg-destructive/15 transition-colors w-fit"
          >
            <AlertTriangle size={16} />
            {purchaseList.length} item(ns) precisam de compra
            <ChevronRight size={14} />
          </Link>
        )}
        {dueCategories.length > 0 && (
          <Link
            href="/compras/contagem"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive hover:bg-destructive/15 transition-colors w-fit"
          >
            <AlertTriangle size={16} />
            {dueCategories.length} categoria(s) precisam de contagem física
            <ChevronRight size={14} />
          </Link>
        )}
      </div>

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

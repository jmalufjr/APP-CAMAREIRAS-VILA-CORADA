import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getPurchaseList } from "@/lib/actions/purchase-list";
import { getSubcenterGroupCountStatus } from "@/lib/actions/inventory-counts";
import { getExpiringLots } from "@/lib/actions/expiry";
import { ClipboardList, PackageMinus, ChevronRight, AlertTriangle, ShoppingCart, TrendingDown } from "lucide-react";

const menuItems = [
  { href: "/compras/baixa", label: "Baixa de estoque", icon: PackageMinus },
  { href: "/compras/inventario", label: "Inventário", icon: ClipboardList },
  { href: "/compras/previsao-estoque", label: "Previsão de estoque", icon: ShoppingCart },
  { href: "/compras/quebra-estoque", label: "Quebra de estoque", icon: TrendingDown },
];

export default async function ComprasPage() {
  const [purchaseList, countStatuses, expiringLots] = await Promise.all([
    getPurchaseList(),
    getSubcenterGroupCountStatus(),
    getExpiringLots(),
  ]);
  const dueCategories = countStatuses.filter((s) => s.is_due);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
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
        {expiringLots.length > 0 && (
          <Link
            href="/compras/validade"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive hover:bg-destructive/15 transition-colors w-fit"
          >
            <AlertTriangle size={16} />
            {expiringLots.length} lote(s) vencidos ou perto de vencer
            <ChevronRight size={14} />
          </Link>
        )}
        {dueCategories.length > 0 && (
          <Link
            href="/compras/inventario"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive hover:bg-destructive/15 transition-colors w-fit"
          >
            <AlertTriangle size={16} />
            {dueCategories.length} grupo(s) de itens precisam de contagem física
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

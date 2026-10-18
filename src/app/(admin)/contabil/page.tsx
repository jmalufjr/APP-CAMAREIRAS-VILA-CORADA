import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashAndBankBalances } from "@/lib/actions/ledger";
import { getCurrentProfile } from "@/lib/actions/session";
import {
  ChevronRight,
  CircleDollarSign,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Archive,
  Download,
  Receipt,
  CalendarClock,
  FileBarChart,
  ListChecks,
  PackageMinus,
} from "lucide-react";

// Módulo Contábil — Levas 1/2/3/4/5 trouxeram o plano de contas contábil,
// o livro de lançamentos, pagamentos/recebimentos, fornecedores e a
// valorização/baixa de estoque. A Leva 6 (PRD_compras&contabil.md seção
// 28) consolidou aqui os 5 itens que antes viviam soltos no menu
// principal do admin (Lançar Compra, Lista de compras, Estoque, Ativo
// Permanente, Custos e Despesas) e acrescentou o "Saldo de caixa e
// bancos" (PRD seção 9.1), lido direto do livro de lançamentos.
const menuItems = [
  { href: "/compras/nova", label: "Lançar Compra", icon: Plus },
  { href: "/despesas/nova", label: "Lançar Despesa", icon: Receipt },
  { href: "/compras/lista", label: "Lista de compras", icon: ShoppingBasket },
  { href: "/compras/validade", label: "Produtos com data de validade próximo ao vencimento", icon: CalendarClock },
  { href: "/compras/baixa", label: "Baixa de estoque", icon: PackageMinus },
  { href: "/compras", label: "Estoque", icon: ShoppingCart },
  { href: "/ativo-permanente", label: "Ativo Permanente", icon: Archive },
  { href: "/contabil/pagamentos", label: "Pagamentos e recebimentos", icon: CircleDollarSign },
  { href: "/contabil/demonstrativos", label: "Demonstrativos e Relatórios", icon: FileBarChart },
  { href: "/contabil/listas", label: "Listas contábeis", icon: ListChecks },
  { href: "/contabil/exportacoes", label: "Exportações para o sistema financeiro", icon: Download },
];

function fmt(v: number): string {
  return `R$ ${v.toFixed(2)}`;
}

const GERENTE_HREFS = new Set(["/compras/nova", "/compras/lista", "/compras/validade", "/compras/baixa"]);

export default async function ModuloContabilPage() {
  const profile = await getCurrentProfile();
  const isGerente = profile.role === "gerente_operacional";
  const balances = isGerente ? { caixa: 0, banco: 0 } : await getCashAndBankBalances();
  const items = isGerente ? menuItems.filter((i) => GERENTE_HREFS.has(i.href)) : menuItems;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulo Contábil"
        subtitle="Compras, fornecedores, estoque, ativo permanente, plano de contas e partidas dobradas — tudo que envolve dinheiro, num lugar só."
      />

      {!isGerente && (
      <div className="grid sm:grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Saldo em caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-medium">{fmt(balances.caixa)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Saldo em banco</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-medium">{fmt(balances.banco)}</p>
          </CardContent>
        </Card>
      </div>
      )}

      <nav className="max-w-md space-y-1.5">
        {items.map((item) => (
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

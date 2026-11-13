import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonthlyResult } from "@/lib/actions/monthly-result";
import { todayKey } from "@/lib/date";
import { getCurrentProfile } from "@/lib/actions/session";
import {
  ChevronRight,
  Plus,
  Archive,
  FileBarChart,
  ListChecks,
  FileSpreadsheet,
} from "lucide-react";

// Módulo gerencial (ex-Módulo Contábil). No topo, só o administrador vê o "Lucro gerencial do mês"
// (o mesmo número do fim do Resultado mensal, do mês corrente).
const menuItems = [
  { href: "/contabil/resultado-mensal", label: "Resultado mensal", icon: FileBarChart },
  { href: "/contabil/compras/caixa", label: "Caixa de conferência de compras (WhatsApp)", icon: ListChecks },
  { href: "/contabil/custo-produtos", label: "Rentabilidade de Petiscos e Drinks", icon: FileBarChart },
  { href: "/contabil/compras/nova", label: "Lançar compra ou despesa", icon: Plus },
  { href: "/contabil/compras/relatorio", label: "Relatório de despesas (regime caixa)", icon: FileSpreadsheet },
  { href: "/ativo-permanente", label: "Inventário de ativo permanente", icon: Archive },
  { href: "/contabil/listas", label: "Listas gerenciais", icon: ListChecks },
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const GERENTE_HREFS = new Set(["/contabil/compras/caixa", "/contabil/compras/nova", "/contabil/compras/relatorio"]);

export default async function ModuloContabilPage() {
  const profile = await getCurrentProfile();
  const isGerente = profile.role === "gerente_operacional";
  const monthKey = todayKey().slice(0, 7);
  const result = isGerente ? null : await getMonthlyResult(monthKey);
  const items = isGerente ? menuItems.filter((i) => GERENTE_HREFS.has(i.href)) : menuItems;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulo gerencial"
        subtitle="Compras e despesas, resultado mensal, rentabilidade de petiscos e drinks e ativo permanente — tudo que envolve dinheiro, num lugar só."
      />

      {!isGerente && result && (
        <div className="max-w-md">
          <Link href="/contabil/resultado-mensal" className="block">
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle className="font-heading text-base">Lucro gerencial do mês</CardTitle>
              </CardHeader>
              <CardContent>
                {"error" in result ? (
                  <p className="text-sm text-red-600">{result.error}</p>
                ) : (
                  <>
                    <p className={`text-xl font-medium ${result.operatingResult < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      {brl(result.operatingResult)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {monthKey.split("-").reverse().join("/")} · resultado parcial, até hoje · clique para ver o Resultado mensal
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
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

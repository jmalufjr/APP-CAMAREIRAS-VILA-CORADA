import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { getPurchasesReport, generateDueRecurring } from "@/lib/actions/purchases-new";
import { getCurrentProfile } from "@/lib/actions/session";
import { getExpenseCategories, getExpenseSettings } from "@/lib/actions/expense-model";
import { todayKey } from "@/lib/date";
import { PurchasesTable } from "./purchases-table";

function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
}

export default async function RelatorioDespesasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();
  await generateDueRecurring();

  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayKey().slice(0, 7);
  const { from, to } = monthRange(month);
  const purchases = await getPurchasesReport(from, to);
  const settings = await getExpenseSettings();
  const categories = (await getExpenseCategories()).filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }));

  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil" />
      <PageHeader
        title="Relatório de despesas (regime caixa)"
        subtitle="Todas as compras e despesas, uma a uma, em ordem da data da compra — a mesma data do pagamento, para conferir com o extrato do banco. Lançamentos feitos depois do fim do mês trazem uma marca; os de mais de 30 dias ficam em vermelho até o admin aprovar ou cancelar."
      />
      <div className="flex items-center gap-2">
        <Link href={`/contabil/compras/relatorio?mes=${prev}`}>
          <Button variant="outline" size="sm">← {prev.split("-").reverse().join("/")}</Button>
        </Link>
        <span className="text-sm font-medium px-2">{month.split("-").reverse().join("/")}</span>
        <Link href={`/contabil/compras/relatorio?mes=${next}`}>
          <Button variant="outline" size="sm">{next.split("-").reverse().join("/")} →</Button>
        </Link>
        <Link href="/contabil/compras/nova" className="ml-auto">
          <Button size="sm">Lançar compra</Button>
        </Link>
      </div>
      <PurchasesTable purchases={purchases} isAdmin={profile.role === "admin"} categories={categories} today={todayKey()} lateWindowDays={settings.late_window_days} />
    </div>
  );
}

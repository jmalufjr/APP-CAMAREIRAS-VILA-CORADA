import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { getMonthlyResult } from "@/lib/actions/monthly-result";
import { todayKey } from "@/lib/date";
import { CENTER_LABELS } from "@/lib/expense-model-types";
import { PendingRevenuePanel } from "./pending-revenue-panel";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dmy = (d: string) => d.split("-").reverse().join("/");

function Row({ label, value, bold, indent }: { label: string; value: number; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 text-sm ${bold ? "font-semibold" : ""} ${indent ? "pl-4 text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={value < 0 ? "text-red-600 dark:text-red-400" : ""}>{brl(value)}</span>
    </div>
  );
}

export default async function ResultadoMensalPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayKey().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  const r = await getMonthlyResult(month);

  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink href="/contabil" />
      <PageHeader
        title="Resultado mensal"
        subtitle="Receitas e despesas do mês por centro de custo. Receita de bar e frigobar vale no mês em que o pedido foi lançado (só de contas já fechadas); hospedagem vem da Stays."
      />
      <div className="flex items-center gap-2">
        <Link href={`/contabil/resultado-mensal?mes=${prev}`}>
          <Button variant="outline" size="sm">← {prev.split("-").reverse().join("/")}</Button>
        </Link>
        <span className="text-sm font-medium px-2">{month.split("-").reverse().join("/")}</span>
        <Link href={`/contabil/resultado-mensal?mes=${next}`}>
          <Button variant="outline" size="sm">{next.split("-").reverse().join("/")} →</Button>
        </Link>
      </div>

      {"error" in r ? (
        <p className="text-sm text-red-600">{r.error}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {r.windowClosed
              ? `Mês consolidado (a janela de lançamentos tardios terminou em ${dmy(r.windowEnd)}).`
              : r.monthClosed
                ? `Mês fechado. Lançamentos tardios entram automaticamente até ${dmy(r.windowEnd)}.`
                : "Mês em andamento — resultado parcial."}
            {r.lateExpensesCount > 0 && ` · ${r.lateExpensesCount} despesa(s) lançada(s) após o fechamento.`}
          </p>

          {(r.pendingRevenue.length > 0 || r.lodging.pendingDiff) && <PendingRevenuePanel result={r} />}

          <section className="rounded-lg border border-border bg-card p-4 space-y-1">
            <h3 className="font-heading text-lg mb-1">Receitas</h3>
            <Row label="Hospedagem bruta" value={r.lodging.gross} />
            <Row label="(−) Comissão dos canais de venda" value={-r.lodging.commission} indent />
            <Row label="Hospedagem líquida" value={r.lodging.net} bold />
            <Row label="Bar — consumo" value={r.bar.items} />
            <Row label="Bar — taxa de serviço" value={r.bar.service} indent />
            <Row label="Frigobar" value={r.frigobar.total} />
            <Row label="Total das receitas" value={r.totalRevenue} bold />
            {(r.bar.toClose > 0 || r.frigobar.toClose > 0) && (
              <p className="text-xs text-muted-foreground pt-1">
                Contas ainda abertas, a fechar (não contam enquanto não fecharem): bar {brl(r.bar.toClose)} · frigobar {brl(r.frigobar.toClose)}.
              </p>
            )}
          </section>

          {r.byCenter.map((c) => (
            <section key={c.center} className="rounded-lg border border-border bg-card p-4 space-y-1">
              <h3 className="font-heading text-lg mb-1">{CENTER_LABELS[c.center]}</h3>
              <Row label="Receita" value={c.revenue} />
              {c.categories.map((cat) => (
                <Row key={cat.name} label={`(−) ${cat.name}`} value={-cat.amount} indent />
              ))}
              <Row label="Total das despesas" value={-c.expenses} />
              <Row label="Resultado do centro" value={c.result} bold />
            </section>
          ))}

          <section className="rounded-lg border border-border bg-card p-4 space-y-1">
            <h3 className="font-heading text-lg mb-1">Resultado total</h3>
            <Row label="Receitas" value={r.totalRevenue} />
            <Row label="(−) Despesas dos centros" value={-r.totalExpenses} />
            <Row label="Resultado antes dos impostos" value={r.totalBeforeTaxes} bold />
            <Row label="(−) Impostos" value={-r.taxes} indent />
            <Row label="Lucro operacional gerencial do mês" value={r.operatingResult} bold />
            <p className="text-xs text-muted-foreground pt-2">
              Demais bebidas foram divididas entre Bar e Frigobar na proporção das quantidades do mês (Bar {Math.round(r.barShare * 100)}%). Despesas de consumo mensal e as demais seguem o rateio cadastrado nas categorias. Sem depreciação.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

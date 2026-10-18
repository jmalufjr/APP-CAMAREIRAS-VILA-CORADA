import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { ReportFilters, ReportView } from "@/components/shared/report-view";
import { toDateKey, nowInBrazil } from "@/lib/date";

function defaultRange() {
  const now = nowInBrazil();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toDateKey(start), to: toDateKey(now) };
}
import { getLivroCaixaBancos } from "@/lib/actions/ledger-reports";

export default async function LivroCaixaBancosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; conta?: string; texto?: string; min?: string; max?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from || range.from;
  const to = sp.to || range.to;
  const conta = sp.conta === "caixa" || sp.conta === "banco" ? sp.conta : "todos";

  const data = await getLivroCaixaBancos({
    from,
    to,
    account: conta,
    text: sp.texto,
    min: sp.min ? Number(sp.min) : undefined,
    max: sp.max ? Number(sp.max) : undefined,
  });
  const rows = data.map((r) => [r.date, r.account, r.description, r.origin, r.inflow, r.outflow, r.balance]);

  return (
    <div className="space-y-6">
      <BackLink href="/contabil/demonstrativos" />
      <PageHeader
        title="Livro caixa e bancos"
        subtitle="Entradas e saídas de dinheiro (Caixa) e de valores movimentados pelo banco (PIX, cartão, transferência…), em ordem cronológica. O saldo é sempre o saldo real da conta, mesmo com filtros."
      />
      <ReportFilters
        basePath="/contabil/demonstrativos/livro-caixa-bancos"
        fields={[
          { name: "from", label: "De", type: "date", value: from },
          { name: "to", label: "Até", type: "date", value: to },
          {
            name: "conta",
            label: "Conta",
            type: "select",
            value: conta,
            options: [
              { value: "todos", label: "Caixa e banco" },
              { value: "caixa", label: "Só caixa" },
              { value: "banco", label: "Só banco" },
            ],
          },
          { name: "texto", label: "Descrição contém", type: "text", value: sp.texto ?? "", placeholder: "ex.: suíte 3" },
          { name: "min", label: "Valor de (R$)", type: "number", value: sp.min ?? "" },
          { name: "max", label: "Valor até (R$)", type: "number", value: sp.max ?? "" },
        ]}
      />
      <ReportView
        title="Livro caixa e bancos"
        subtitle={`Período: ${from} a ${to}${conta !== "todos" ? " · " + conta : ""}${sp.texto ? " · descrição: " + sp.texto : ""}`}
        filenameBase={`livro-caixa-bancos-${from}-a-${to}`}
        columns={["Data", "Conta", "Descrição", "Origem", "Entrada (recebimento)", "Saída (pagamento)", "Saldo da conta"]}
        rows={rows}
        numericColumns={[4, 5, 6]}
      />
    </div>
  );
}

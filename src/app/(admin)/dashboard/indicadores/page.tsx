import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIndicators } from "@/lib/actions/indicators";
import { formatDateTimePt, monthYearLabelPt } from "@/lib/date";
import type { MonthIndicators } from "@/lib/stays/indicators";
import { RefreshButton } from "./refresh-button";

const money = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1).replace(".", ",")}%`);
const int = (n: number) => n.toLocaleString("pt-BR");

function IndicatorsTable({ rows, emptyText }: { rows: MonthIndicators[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full whitespace-nowrap text-sm">
        <thead className="bg-muted/60 text-left text-xs">
          <tr>
            <th className="sticky left-0 bg-muted px-3 py-2 font-medium">Mês</th>
            <th className="px-3 py-2 text-right font-medium">Total de noites vendidas</th>
            <th className="px-3 py-2 text-right font-medium">Gratuitas</th>
            <th className="px-3 py-2 text-right font-medium">Bloqueio</th>
            <th className="px-3 py-2 text-right font-medium">Manutenção</th>
            <th className="px-3 py-2 text-right font-medium">Número de suítes</th>
            <th className="px-3 py-2 text-right font-medium">Total de noites disponíveis (STR)</th>
            <th className="px-3 py-2 text-right font-medium">Total de noites disponíveis (PRD)</th>
            <th className="px-3 py-2 text-right font-medium">Receita de hospedagem</th>
            <th className="px-3 py-2 text-right font-medium">Comissões</th>
            <th className="px-3 py-2 text-right font-medium">Receita líquida</th>
            <th className="px-3 py-2 text-right font-medium">ADR</th>
            <th className="px-3 py-2 text-right font-medium">RevPAR (STR)</th>
            <th className="px-3 py-2 text-right font-medium">RevPAR (PRD)</th>
            <th className="px-3 py-2 text-right font-medium">NetRevPAR (STR)</th>
            <th className="px-3 py-2 text-right font-medium">NetRevPAR (PRD)</th>
            <th className="px-3 py-2 text-right font-medium">Ocupação comercial (STR)</th>
            <th className="px-3 py-2 text-right font-medium">Ocupação comercial (PRD)</th>
            <th className="px-3 py-2 text-right font-medium">Ocupação física</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.month} className="border-t border-border">
              <td className="sticky left-0 bg-card px-3 py-2 font-medium">{monthYearLabelPt(m.month)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{int(m.paid)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{int(m.free)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{int(m.blocked)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{int(m.maintenance)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{int(m.rooms)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{int(m.supply)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{int(m.availablePrd)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(m.revenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(m.commission)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(m.netRevenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{money(m.adr)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{money(m.revpar)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{money(m.revparPrd)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{money(m.netRevpar)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{money(m.netRevparPrd)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{pct(m.occCommercial)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{pct(m.occCommercialPrd)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{pct(m.occPhysical)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function IndicadoresPage() {
  const result = await getIndicators();

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <BackLink href="/dashboard" />
        <PageHeader title="Indicadores" subtitle="ADR, RevPAR, NetRevPAR e ocupação por mês." />
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" />
      <PageHeader
        title="Indicadores"
        subtitle="ADR, RevPAR, NetRevPAR e taxas de ocupação por mês, calculados por diária (check-in inclusivo, check-out exclusivo) com os dados da Stays."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Como os números são calculados (resumo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p>
            <strong>ADR</strong> = receita bruta de hospedagem ÷ diárias vendidas (só as com cobrança). <strong>RevPAR</strong> = receita
            bruta ÷ diárias disponíveis. <strong>NetRevPAR</strong> = (receita bruta − comissões) ÷ diárias disponíveis.{" "}
            <strong>Ocupação comercial</strong> = diárias vendidas ÷ diárias disponíveis. <strong>Ocupação física</strong> = (vendidas +
            gratuitas + bloqueadas) ÷ (disponíveis − manutenção).
          </p>
          <p>
            Onde o pedido original (PRD) e o padrão da STR/CoStar diferem, a tela mostra <strong>as duas colunas</strong>:{" "}
            <strong>(STR)</strong> usa como diárias disponíveis todas as suítes × os dias do mês, sem descontar nada; <strong>(PRD)</strong>{" "}
            desconta as noites de bloqueio e manutenção (RevPAR e NetRevPAR) ou só as de manutenção (ocupação comercial). ADR e ocupação
            física não divergem.
          </p>
          <p className="text-muted-foreground">
            O <strong>número de suítes</strong> de cada mês é fixo: 1 até dezembro de 2024, 5 de janeiro a setembro de 2025, 7 de outubro a
            dezembro de 2025 e 11 a partir de janeiro de 2026; as noites disponíveis são esse número × os dias do mês. As{" "}
            <strong>comissões</strong> são as informadas pela Stays em cada reserva (Booking, Airbnb e Decolar/Despegar, em R$, repartidas entre as
            diárias); a Expedia e as reservas diretas não têm comissão (a diária da Expedia já vem líquida, e ela cobra o hóspede). Diárias
            gratuitas não entram em receita nem em “vendidas”. A receita é só de hospedagem, sem impostos e taxas. Reservas canceladas ficam de
            fora. Detalhes em “Questões e Respostas”.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Mês corrente e meses seguintes (ainda não fechados)</h2>
        <p className="text-xs text-muted-foreground">
          Mostram só o que já está reservado até hoje: os valores ainda mudam com novas reservas, cancelamentos e com a passagem dos dias.
        </p>
        <IndicatorsTable rows={result.open} emptyText="Sem dados para o mês corrente e os seguintes." />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg text-primary">Meses fechados</h2>
        <p className="text-xs text-muted-foreground">
          Meses já encerrados, do mais recente para o mais antigo. As comissões são as que a Stays informou em cada reserva (Booking, Airbnb e Decolar); Expedia e reservas diretas não têm comissão.
        </p>
        <IndicatorsTable rows={result.closed} emptyText="Nenhum mês fechado com dados." />
      </section>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Última atualização: {result.syncedAt ? formatDateTimePt(result.syncedAt) : "—"} (a cada sincronização com a Stays).</span>
        <RefreshButton />
      </div>
    </div>
  );
}

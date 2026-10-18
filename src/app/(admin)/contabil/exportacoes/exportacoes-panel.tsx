"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadCsv, csvMetadataHeader } from "@/lib/csv-export";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-method";
import type { PoolbarItemTotal } from "@/lib/actions/poolbar";
import type { MinibarItemTotal } from "@/lib/actions/minibar";
import type { ReceiptsByPaymentMethodRow } from "@/lib/actions/room-bills";
import type { CostCentersSummary, BarFrigobarCmvSummary, BreakfastCostSummary } from "@/lib/actions/cost-accounting";
import type { InventoryStockReportRow } from "@/lib/actions/inventory-report";
import { Download } from "lucide-react";

function fmt(v: number): string {
  return `R$ ${v.toFixed(2)}`;
}

function ExportCard({
  title,
  description,
  onDownload,
}: {
  title: string;
  description: string;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button size="sm" onClick={onDownload}>
          <Download size={14} /> Baixar CSV
        </Button>
      </CardContent>
    </Card>
  );
}

export function ExportacoesPanel({
  from,
  to,
  poolbar,
  minibar,
  receiptsByMethod,
  costSummary,
  cmv,
  breakfast,
  stock,
}: {
  from: string;
  to: string;
  poolbar: { items: PoolbarItemTotal[]; total: number };
  minibar: { items: MinibarItemTotal[]; total: number };
  receiptsByMethod: ReceiptsByPaymentMethodRow[];
  costSummary: CostCentersSummary;
  cmv: BarFrigobarCmvSummary;
  breakfast: BreakfastCostSummary;
  stock: InventoryStockReportRow[];
}) {
  const generatedAt = () => new Date().toISOString();
  const header = (extra?: (string | number)[][]) => [...csvMetadataHeader(from, to, generatedAt()), ...(extra ?? [])];

  function exportReceita() {
    downloadCsv(
      `receita-bar-frigobar_${from}_${to}.csv`,
      header([
        ["Canal", "Item", "Quantidade", "Valor (R$)"],
        ...poolbar.items.map((i) => ["Bar da piscina", i.name, i.quantity, i.total.toFixed(2)]),
        ...minibar.items.map((i) => ["Frigobar", i.name, i.quantity, i.total.toFixed(2)]),
        ["Total", "", "", (poolbar.total + minibar.total).toFixed(2)],
      ])
    );
  }

  function exportRecebimentos() {
    downloadCsv(
      `recebimentos-por-forma-pagamento_${from}_${to}.csv`,
      header([
        ["Forma de pagamento", "Quantidade de contas", "Valor (R$)"],
        ...receiptsByMethod.map((r) => [
          r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] : "—",
          r.count,
          r.total.toFixed(2),
        ]),
      ])
    );
  }

  function exportCustosPorCentro() {
    downloadCsv(
      `custos-por-centro_${from}_${to}.csv`,
      header([
        ["Centro de custo", "Total (R$)"],
        ...costSummary.centerTotals.map((c) => [c.center_name, c.total.toFixed(2)]),
      ])
    );
  }

  function exportDespesasPorItem() {
    const rows: (string | number)[][] = [["Item de custo", "Gasto total (R$)", "Centro", "Valor no centro (R$)"]];
    costSummary.breakdown.forEach((b) => {
      if (b.by_center.length === 0) {
        rows.push([b.cost_item_name, b.total_spend.toFixed(2), "Sem centro vinculado", ""]);
      } else {
        b.by_center.forEach((c) => rows.push([b.cost_item_name, b.total_spend.toFixed(2), c.center_name, c.amount.toFixed(2)]));
      }
    });
    downloadCsv(`despesas-por-item-de-custo_${from}_${to}.csv`, header(rows));
  }

  function exportEstoque() {
    downloadCsv(
      `saldo-de-estoque_${from}_${to}.csv`,
      header([
        ["Item", "Unidade", "Categoria", "Saldo", "Custo médio (R$)", "Valor em estoque (R$)"],
        ...stock.map((i) => [i.item_name, i.unit, i.category_name, i.balance, i.avg_cost.toFixed(2), i.stock_value.toFixed(2)]),
      ])
    );
  }

  function exportCmv() {
    downloadCsv(
      `cmv-margem-bruta-bar-frigobar_${from}_${to}.csv`,
      header([
        ["Receita bruta (R$)", "CMV (R$)", "Margem bruta (R$)", "Margem bruta (%)"],
        [cmv.revenue.toFixed(2), cmv.cmv.toFixed(2), cmv.grossMargin.toFixed(2), cmv.grossMarginPct?.toFixed(1) ?? ""],
      ])
    );
  }

  function exportCafe() {
    const rows: (string | number)[][] = [
      ["Cafés servidos", "Custo de insumos (R$)", "Outros custos diretos (R$)", "Custo total (R$)", "Custo por café (insumos)", "Custo por café (total)"],
      [
        breakfast.guestsServed,
        breakfast.insumosCost.toFixed(2),
        breakfast.otherCost.toFixed(2),
        breakfast.totalCost.toFixed(2),
        breakfast.costPerGuestInsumos?.toFixed(2) ?? "",
        breakfast.costPerGuestTotal?.toFixed(2) ?? "",
      ],
      [],
      ["Item", "Como entrou", "Valor no período (R$)"],
      ...breakfast.byItem.map((i) => [i.label, i.method === "comprado" ? "Comprado no período" : "Baixado (custo médio)", i.total.toFixed(2)]),
    ];
    downloadCsv(`custo-cafe-da-manha_${from}_${to}.csv`, header(rows));
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <ExportCard
        title="Receitas de bar e frigobar"
        description={`Por item e canal — total do período: ${fmt(poolbar.total + minibar.total)}.`}
        onDownload={exportReceita}
      />
      <ExportCard
        title="Recebimentos por forma de pagamento"
        description={`${receiptsByMethod.length} forma(s) de pagamento usada(s) no período.`}
        onDownload={exportRecebimentos}
      />
      <ExportCard
        title="Custos por centro de custo"
        description={`${costSummary.centerTotals.length} centro(s) com gasto no período.`}
        onDownload={exportCustosPorCentro}
      />
      <ExportCard
        title="Despesas por item de custo"
        description={`Detalhe de ${costSummary.breakdown.length} item(ns) de custo, por centro.`}
        onDownload={exportDespesasPorItem}
      />
      <ExportCard
        title="Saldo de estoque e valores"
        description={`${stock.length} item(ns) de estoque — saldo atual (não filtrado por período).`}
        onDownload={exportEstoque}
      />
      <ExportCard
        title="CMV e margem bruta — Bar e Frigobar"
        description={`Margem bruta: ${fmt(cmv.grossMargin)} (${cmv.grossMarginPct?.toFixed(1) ?? "—"}%).`}
        onDownload={exportCmv}
      />
      <ExportCard
        title="Custo do café da manhã por hóspede"
        description={`${breakfast.guestsServed} café(s) servido(s) no período.`}
        onDownload={exportCafe}
      />
    </div>
  );
}

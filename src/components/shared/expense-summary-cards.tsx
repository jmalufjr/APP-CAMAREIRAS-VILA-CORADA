import type { ExpenseSupplierSummaryRow } from "@/lib/actions/expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ExpenseCenterSummaryRow {
  center_name: string;
  total: number;
}

// "Total por centro de custo" e "total por fornecedor", lado a lado — os
// dois ao mesmo tempo, conforme pedido, cada um reaproveitando o mesmo
// período já filtrado na tela.
export function ExpenseSummaryCards({
  byCenter,
  bySupplier,
}: {
  byCenter: ExpenseCenterSummaryRow[];
  bySupplier: ExpenseSupplierSummaryRow[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Total por centro de custo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {byCenter.map((s) => (
            <div key={s.center_name} className="flex justify-between text-sm">
              <span>{s.center_name}</span>
              <span className="font-medium">R$ {s.total.toFixed(2)}</span>
            </div>
          ))}
          {byCenter.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Total por fornecedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {bySupplier.map((s) => (
            <div key={s.supplier_name} className="flex justify-between text-sm">
              <span>{s.supplier_name}</span>
              <span className="font-medium">R$ {s.total.toFixed(2)}</span>
            </div>
          ))}
          {bySupplier.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

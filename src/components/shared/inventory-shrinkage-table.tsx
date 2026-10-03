import type { InventoryCountLineHistory } from "@/lib/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDateShortPt, dateKeyInBrazil } from "@/lib/date";

function formatPct(v: number | null): string {
  if (v === null) return "—";
  const rounded = Math.round(v * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatDate(iso: string | null): string {
  return iso ? formatDateShortPt(dateKeyInBrazil(iso)) : "—";
}

// Tabela com os mesmos dados mostrados na tela "Contagem de Estoque", por
// contagem fechada — reaproveitada pelo card do Histórico e pela tela
// "Quebra de Estoque" do Resumo Executivo (ver PRD_compras.md seção 18).
export function InventoryShrinkageTable({ rows }: { rows: InventoryCountLineHistory[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Nenhuma contagem registrada nesse período.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Data da contagem</TableHead>
            <TableHead>Contagem anterior</TableHead>
            <TableHead>Saldo no sistema</TableHead>
            <TableHead>Contagem física</TableHead>
            <TableHead>Diferença</TableHead>
            <TableHead>Quebra de estoque</TableHead>
            <TableHead>Quebra 12 meses</TableHead>
            <TableHead>Quebra máxima admitida</TableHead>
            <TableHead>Índice relativo</TableHead>
            <TableHead>Índice relativo máximo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isAboveQuebraMaxima = r.quebra_pct !== null && Math.abs(r.quebra_pct) > r.quebra_maxima_admitida_pct;
            const isOutlier = r.indice_relativo_pct !== null && r.indice_relativo_pct > r.indice_relativo_maximo_pct;
            return (
              <TableRow key={r.id}>
                <TableCell>{r.item_name}</TableCell>
                <TableCell>{r.category_name}</TableCell>
                <TableCell>{formatDate(r.closed_at)}</TableCell>
                <TableCell>{formatDate(r.previous_count_date)}</TableCell>
                <TableCell>
                  {r.theoretical_qty} {r.unit}
                </TableCell>
                <TableCell>
                  {r.counted_qty} {r.unit}
                </TableCell>
                <TableCell className={r.diferenca !== 0 ? "text-destructive font-medium" : ""}>
                  {r.diferenca > 0 ? `+${r.diferenca}` : r.diferenca}
                </TableCell>
                <TableCell className={isAboveQuebraMaxima ? "text-destructive font-medium" : ""}>{formatPct(r.quebra_pct)}</TableCell>
                <TableCell>{formatPct(r.quebra_12m_pct)}</TableCell>
                <TableCell>{r.quebra_maxima_admitida_pct}%</TableCell>
                <TableCell className={isOutlier ? "text-destructive font-medium" : ""}>
                  {r.indice_relativo_pct === null ? "—" : `${Math.round(r.indice_relativo_pct)}%`}
                </TableCell>
                <TableCell>{r.indice_relativo_maximo_pct}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

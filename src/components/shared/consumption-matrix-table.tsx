import Link from "next/link";
import type { ConsumptionMatrix } from "@/lib/bill-consumption";

// Tabela de consumo de uma conta: linhas = itens, colunas = quando foi lançado, última coluna = total.
// Colunas de comanda sempre levam à página da comanda; colunas de serviço só levam à tela do serviço
// quando `serviceHref` é informado (tela do admin).
export function ConsumptionMatrixTable({
  matrix,
  emptyText,
  serviceHref,
}: {
  matrix: ConsumptionMatrix;
  emptyText: string;
  serviceHref?: (taskId: string) => string;
}) {
  if (matrix.rows.length === 0) return <p className="text-sm text-muted-foreground py-2">{emptyText}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Item</th>
            {matrix.columns.map((c) => {
              const href = c.comandaId ? `/comanda/${c.comandaId}` : c.taskId && serviceHref ? serviceHref(c.taskId) : null;
              const content = (
                <>
                  <span className="block font-medium text-foreground">{c.title}</span>
                  {c.subtitle && <span className="block font-normal">{c.subtitle}</span>}
                </>
              );
              return (
                <th key={c.key} className="px-2 py-1 text-center align-bottom">
                  {href ? (
                    <Link href={href} className="block rounded px-1 hover:bg-accent hover:underline">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </th>
              );
            })}
            <th className="py-1 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50 last:border-0">
              <td className="py-1 pr-3">{r.name}</td>
              {r.cells.map((v, i) => (
                <td key={i} className="px-2 py-1 text-center tabular-nums">
                  {v === 0 ? <span className="text-muted-foreground">—</span> : v}
                </td>
              ))}
              <td className="py-1 pl-2 text-right font-medium tabular-nums">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

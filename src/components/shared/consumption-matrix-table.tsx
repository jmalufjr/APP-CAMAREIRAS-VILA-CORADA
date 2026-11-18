"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ConsumptionColumn, ConsumptionMatrix } from "@/lib/bill-consumption";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Tabela de consumo de uma conta: linhas = itens, colunas = quando foi lançado, última coluna = total.
// Colunas de comanda sempre levam à página da comanda; colunas de serviço só levam à tela do serviço
// quando `serviceHref` é informado (tela do admin). `onEditColumn` mostra o lápis de edição direta; uma
// coluna editada ganha a marca "editado" (passe o mouse ou toque para ver quem, quando e o valor anterior).
export function ConsumptionMatrixTable({
  matrix,
  emptyText,
  serviceHref,
  onEditColumn,
}: {
  matrix: ConsumptionMatrix;
  emptyText: string;
  serviceHref?: (taskId: string) => string;
  onEditColumn?: (column: ConsumptionColumn) => void;
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
                  <div className="mt-0.5 flex items-center justify-center gap-1">
                    {onEditColumn && c.kind !== "comanda" && (
                      <button
                        type="button"
                        title="Editar esta coluna"
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => onEditColumn(c)}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    {c.edits && c.edits.length > 0 && (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button type="button" title="Ver edições" className="rounded border border-border px-1 text-[10px] font-normal text-muted-foreground hover:bg-accent">
                              editado
                            </button>
                          }
                        />
                        <PopoverContent className="w-72 space-y-1.5 text-xs" align="center">
                          {c.edits.map((e, i) => (
                            <p key={i}>
                              <span className="font-medium">{e.at} — {e.actor}</span>
                              <span className="block text-muted-foreground">
                                {e.item}: {e.before} → {e.after}
                              </span>
                            </p>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
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

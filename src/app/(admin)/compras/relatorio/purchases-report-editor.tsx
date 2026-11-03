"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { savePurchaseCorrections } from "@/lib/actions/purchases-report";
import type { PurchaseReportRow, PurchaseCorrection } from "@/lib/actions/purchases-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";

type ItemState = { description: string; quantity: string; unit_cost: string };
type PurchaseState = { date: string; supplier_id: string; document_number: string; items: ItemState[] };

const fmt = (n: number) => String(n).replace(".", ",");
const num = (v: string) => Number(v.replace(",", "."));

function initialState(rows: PurchaseReportRow[]): Record<string, PurchaseState> {
  const map: Record<string, PurchaseState> = {};
  rows.forEach((r) => {
    map[r.id] = {
      date: r.date,
      supplier_id: r.supplier_id ?? "",
      document_number: r.document_number ?? "",
      items: r.items.map((i) => ({ description: i.description, quantity: fmt(i.quantity), unit_cost: fmt(i.unit_cost) })),
    };
  });
  return map;
}

export function PurchasesReportEditor({
  rows,
  suppliers,
  products,
}: {
  rows: PurchaseReportRow[];
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(() => initialState(rows));

  function patchPurchase(id: string, patch: Partial<PurchaseState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  function patchItem(id: string, idx: number, patch: Partial<ItemState>) {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], items: prev[id].items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) },
    }));
  }

  function changedCorrections(): PurchaseCorrection[] {
    const out: PurchaseCorrection[] = [];
    rows.forEach((r) => {
      const s = state[r.id];
      const headerChanged =
        s.date !== r.date || s.supplier_id !== (r.supplier_id ?? "") || s.document_number.trim() !== (r.document_number ?? "");
      const changedItems = r.items
        .map((orig, idx) => ({ orig, cur: s.items[idx], position: idx }))
        .filter(
          ({ orig, cur }) =>
            cur.description.trim() !== orig.description.trim() ||
            num(cur.quantity) !== orig.quantity ||
            num(cur.unit_cost) !== orig.unit_cost
        );
      if (!headerChanged && changedItems.length === 0) return;
      out.push({
        id: r.id,
        date: s.date,
        supplier_id: s.supplier_id || null,
        document_number: s.document_number.trim() || null,
        items: changedItems.map(({ cur, position }) => ({
          position,
          description: cur.description,
          quantity: num(cur.quantity),
          unit_cost: num(cur.unit_cost),
        })),
      });
    });
    return out;
  }

  function save() {
    const corrections = changedCorrections();
    if (corrections.length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    startTransition(async () => {
      const result = await savePurchaseCorrections(corrections);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const r = result as { saved: number; errors: string[] };
      r.errors.forEach((e) => toast.error(e));
      if (r.saved > 0) toast.success(`${r.saved} compra(s) corrigida(s).`);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma compra registrada nos últimos 30 dias.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Quantidade</th>
              <th className="px-3 py-2 font-medium">Preço (R$)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              const s = state[r.id];
              return (
                <PurchaseBlock key={r.id} first={ri === 0}>
                  <tr className="bg-muted/40">
                    <td colSpan={3} className="px-3 py-2">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input type="date" value={s.date} onChange={(e) => patchPurchase(r.id, { date: e.target.value })} aria-label="Data" />
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={s.supplier_id}
                          onChange={(e) => patchPurchase(r.id, { supplier_id: e.target.value })}
                          aria-label="Fornecedor"
                        >
                          <option value="">(sem fornecedor)</option>
                          {suppliers.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={s.document_number}
                          onChange={(e) => patchPurchase(r.id, { document_number: e.target.value })}
                          placeholder="Número da nota"
                          aria-label="Número da nota"
                        />
                      </div>
                    </td>
                  </tr>
                  {r.items.map((it, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <Input
                          list={it.is_asset ? undefined : "report-products"}
                          value={s.items[idx].description}
                          onChange={(e) => patchItem(r.id, idx, { description: e.target.value })}
                          aria-label="Item"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <Input
                            className="w-24"
                            inputMode="decimal"
                            value={s.items[idx].quantity}
                            onChange={(e) => patchItem(r.id, idx, { quantity: e.target.value })}
                            aria-label="Quantidade"
                          />
                          <span className="w-8 text-xs text-muted-foreground">{it.unit ?? ""}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          className="w-28"
                          inputMode="decimal"
                          value={s.items[idx].unit_cost}
                          onChange={(e) => patchItem(r.id, idx, { unit_cost: e.target.value })}
                          aria-label="Preço"
                        />
                      </td>
                    </tr>
                  ))}
                </PurchaseBlock>
              );
            })}
          </tbody>
        </table>
        <datalist id="report-products">
          {products.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </div>
      <Button onClick={save} disabled={isPending}>
        <Save size={16} /> {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}

// Uma compra: (linha em branco de meia altura, exceto antes da primeira) + cabeçalho + itens.
function PurchaseBlock({ first, children }: { first: boolean; children: React.ReactNode }) {
  return (
    <>
      {!first && (
        <tr aria-hidden>
          <td colSpan={3} className="h-4 bg-background p-0" />
        </tr>
      )}
      {children}
    </>
  );
}

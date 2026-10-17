"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
} from "@/lib/actions/products";
import type { ProductRow } from "@/lib/actions/products";
import type { CostCenter, LedgerAccount, ProductCategory } from "@/lib/types";
import { PRODUCT_TYPE_LABELS } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ProductDialog } from "./product-dialog";

interface Candidate {
  id: string;
  name: string;
  centers: { center_id: string; center_name: string; alloc_pct: number }[];
}

export function ProductsPanel({
  products,
  categories,
  centers,
  ledgerAccounts,
  candidates,
}: {
  products: ProductRow[];
  categories: ProductCategory[];
  centers: CostCenter[];
  ledgerAccounts: LedgerAccount[];
  candidates: Candidate[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (!showInactive && !p.active) return false;
    if (categoryFilter !== "all" && (p.category_id ?? "none") !== categoryFilter) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-lg">Produtos</h3>
          <ProductDialog categories={categories} centers={centers} ledgerAccounts={ledgerAccounts} candidates={candidates} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Buscar por nome, código ou código de barras" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
            <SelectTrigger className="w-48">
              <SelectValue>
                {(v: string) => (v === "all" ? "Todas as categorias" : v === "none" ? "Sem categoria" : (categories.find((c) => c.id === v)?.name ?? v))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Mostrar inativos
          </label>
        </div>
        <p className="text-sm font-medium">
          Valor total em estoque: R$ {products.reduce((sum, p) => sum + p.stock_value, 0).toFixed(2)}
        </p>
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {p.name}
                    {p.sku && <span className="ml-1.5 text-xs text-muted-foreground">#{p.sku}</span>}
                    {!p.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativo</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[p.category_name, p.product_type ? PRODUCT_TYPE_LABELS[p.product_type] : null].filter(Boolean).join(" · ") || "Sem categoria"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.centers.length > 0 ? p.centers.map((c) => `${c.center_name} ${c.alloc_pct}%`).join(" · ") : "Sem centro vinculado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conta: {ledgerAccounts.find((a) => a.code === p.ledger_account_code)?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.controls_stock
                      ? `Saldo: ${p.balance} ${p.unit} · custo médio R$ ${p.avg_cost.toFixed(2)} · valor R$ ${p.stock_value.toFixed(2)} · folga ${p.coverage_days} dia(s)${p.is_perishable ? " · perecível" : ""}${p.reorder_point > 0 ? ` · mínimo ${p.reorder_point} ${p.unit}` : ""}${p.shelf_life_days ? ` · validade ${p.shelf_life_days} dia(s)` : ""}`
                      : "Não controla estoque"}
                  </p>
                </div>
                <div className="shrink-0">
                  <ProductDialog product={p} categories={categories} centers={centers} ledgerAccounts={ledgerAccounts} candidates={[]} />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum produto encontrado.</p>}
        </div>
      </section>

      <CategoriesSection categories={categories} />
    </div>
  );
}

function CategoriesSection({ categories }: { categories: ProductCategory[] }) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ error?: string } | { success: boolean }>, ok?: string) {
    startTransition(async () => {
      const r = (await fn()) as { error?: string };
      if (r?.error) toast.error(r.error);
      else {
        if (ok) toast.success(ok);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <h3 className="font-heading text-lg">Categorias de produto</h3>
      <div className="flex gap-2">
        <Input className="max-w-xs" placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              const r = await createProductCategory(name);
              if (!r.error) setName("");
              return r;
            }, "Categoria criada.")
          }
        >
          <Plus size={14} /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-medium">
              {c.name}
              {!c.active && <span className="ml-1.5 text-xs text-muted-foreground">· Inativa</span>}
            </p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={c.active} disabled={isPending} onCheckedChange={(v) => run(() => updateProductCategory(c.id, c.name, v))} />
                Ativa
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => {
                  if (confirm("Excluir esta categoria?")) run(() => deleteProductCategory(c.id), "Removida.");
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { Fragment } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getFixedAssets } from "@/lib/actions/fixed-assets";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDatePt } from "@/lib/date";

export default async function RelacaoAtivoPermanentePage() {
  const assets = await getFixedAssets();
  const active = assets.filter((a) => a.active);

  const byCategory = new Map<string, typeof active>();
  active.forEach((a) => {
    const list = byCategory.get(a.category_name) ?? [];
    list.push(a);
    byCategory.set(a.category_name, list);
  });

  const totalValue = active.reduce((sum, a) => sum + (a.purchase_value ?? 0), 0);

  return (
    <div className="space-y-6">
      <BackLink href="/ativo-permanente" />
      <PageHeader
        title="Relação de Ativo Permanente"
        subtitle={`${active.length} item(ns) registrado(s) · valor total R$ ${totalValue.toFixed(2)}`}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Marca/Modelo</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Data da compra</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Garantia até</TableHead>
              <TableHead>Fornecedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(byCategory.entries()).map(([category, items]) => (
              <Fragment key={category}>
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={7} className="font-medium text-xs uppercase text-muted-foreground">
                    {category}
                  </TableCell>
                </TableRow>
                {items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{[a.brand, a.model].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell>{a.location ?? "—"}</TableCell>
                    <TableCell>{a.purchase_date ? formatDatePt(a.purchase_date) : "—"}</TableCell>
                    <TableCell>{a.purchase_value !== null ? `R$ ${a.purchase_value.toFixed(2)}` : "—"}</TableCell>
                    <TableCell>{a.warranty_until ? formatDatePt(a.warranty_until) : "—"}</TableCell>
                    <TableCell>{a.supplier_name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {active.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum item registrado ainda — os itens serão inseridos durante o inventário inicial.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {Array.from(new Set(active.map((a) => a.location).filter(Boolean))).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Locais cadastrados: {Array.from(new Set(active.map((a) => a.location).filter(Boolean))).join(", ")}
        </p>
      )}
      <ActiveBadgeLegend />
    </div>
  );
}

function ActiveBadgeLegend() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="secondary">Itens inativos não aparecem nesta relação</Badge>
    </div>
  );
}

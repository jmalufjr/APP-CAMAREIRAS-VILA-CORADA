import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getOpenCountSessions } from "@/lib/actions/inventory-counts";
import { getExpenseCategories } from "@/lib/actions/expense-categories";
import { StartCountButton } from "./start-count-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimePt } from "@/lib/date";

export default async function ContagemEstoquePage() {
  const [openSessions, categories] = await Promise.all([getOpenCountSessions(), getExpenseCategories()]);
  const inventoryCategories = categories.filter((c) => c.active && c.is_inventory_category);

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader title="Contagem de estoque" subtitle="Confira o saldo físico contra o saldo calculado pelo sistema." />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Iniciar nova contagem</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <StartCountButton label="Todos os itens" />
          {inventoryCategories.map((c) => (
            <StartCountButton key={c.id} categoryId={c.id} label={c.name} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Contagens em andamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {openSessions.map((s) => (
            <Link
              key={s.id}
              href={`/compras/contagem/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm hover:bg-accent"
            >
              <span>{categories.find((c) => c.id === s.category_id)?.name ?? "Todos os itens"}</span>
              <span className="text-xs text-muted-foreground">Aberta em {formatDateTimePt(s.created_at)}</span>
            </Link>
          ))}
          {openSessions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma contagem em andamento.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

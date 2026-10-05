import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getOpenCountSessions, getSubcenterGroupCountStatus } from "@/lib/actions/inventory-counts";
import { StartCountButton } from "./start-count-button";
import { CategoryCountReminders } from "./category-count-reminders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimePt } from "@/lib/date";

export default async function ContagemEstoquePage() {
  const [openSessions, countStatuses] = await Promise.all([getOpenCountSessions(), getSubcenterGroupCountStatus()]);

  return (
    <div className="space-y-6">
      <BackLink href="/compras" />
      <PageHeader title="Contagem de estoque" subtitle="Confira o saldo físico contra o saldo calculado pelo sistema." />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Contar tudo de uma vez</CardTitle>
        </CardHeader>
        <CardContent>
          <StartCountButton label="Iniciar contagem de todos os itens" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Contar por grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Cada grupo junta os subcentros do Plano de Contas com o mesmo nome (ex.: &quot;Alimentos&quot; do Café da
            manhã e do Bar da piscina) numa contagem só. A frequência (em dias) é opcional — deixe em branco pra não
            receber nenhum aviso.
          </p>
          <CategoryCountReminders statuses={countStatuses} />
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
              <span>{s.subcenter_group_name ?? "Todos os itens"}</span>
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
